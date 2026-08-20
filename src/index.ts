#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TokenCache } from './cache.js';
import { MaskingEngine } from './masking.js';
import { executeQuery, initPool } from './db.js';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
let dbUri = process.env.PGURI || '';
let rosterPath = process.env.ROSTER_PATH || './entityRoster.json';
let ttlSeconds = parseInt(process.env.CACHE_TTL_SEC || '1800', 10);
let isSse = process.env.TRANSPORT === 'sse';
let port = parseInt(process.env.PORT || '3000', 10);
let apiKey = process.env.MCP_API_KEY || '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--db-uri' && args[i + 1]) {
    dbUri = args[i + 1];
    i++;
  } else if (args[i] === '--roster-path' && args[i + 1]) {
    rosterPath = args[i + 1];
    i++;
  } else if (args[i] === '--ttl' && args[i + 1]) {
    ttlSeconds = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--sse') {
    isSse = true;
  } else if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--api-key' && args[i + 1]) {
    apiKey = args[i + 1];
    i++;
  }
}

// Initialize components
if (dbUri) {
  initPool({ connectionString: dbUri });
}

const cache = new TokenCache(ttlSeconds);
let initialRoster: string[] = [];

try {
  const resolvedPath = path.resolve(rosterPath);
  if (fs.existsSync(resolvedPath)) {
    initialRoster = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
  }
} catch (err) {
  console.error('Warning: Failed to load entity roster from ' + rosterPath, err);
}

const engine = new MaskingEngine(cache, initialRoster);

// Global metrics and transport mapping for SSE sessions
const activeTransports = new Map<string, SSEServerTransport>();
const metrics = {
  totalConnections: 0,
  queriesExecuted: 0,
  textUnmasked: 0,
  uniqueIPs: new Set<string>()
};

// Create MCP Server
const server = new Server(
  { name: 'pii-shield-db', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'run_secure_query',
        description: 'Execute a read-only SELECT database query. All PII values (names, emails, phones, NRIC/IDs) in the results will be automatically masked before being returned.',
        inputSchema: {
          type: 'object',
          properties: {
            sql_query: {
              type: 'string',
              description: 'The read-only SQL SELECT query to run (e.g. SELECT name, email FROM contacts LIMIT 5)'
            }
          },
          required: ['sql_query']
        }
      },
      {
        name: 'unmask_text',
        description: 'Restore the original raw PII values in a text payload by replacing placeholders (e.g. __PERSON_A__, __EMAIL_1__) with their original values cached during this session.',
        inputSchema: {
          type: 'object',
          properties: {
            masked_text: {
              type: 'string',
              description: 'The text containing placeholders to be restored.'
            }
          },
          required: ['masked_text']
        }
      },
      {
        name: 'add_to_roster',
        description: 'Register new names to the active regex scan roster for local name-matching detection.',
        inputSchema: {
          type: 'object',
          properties: {
            names: {
              type: 'array',
              items: { type: 'string' },
              description: 'An array of names to be dynamically added to the scanner roster.'
            }
          },
          required: ['names']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'run_secure_query') {
      metrics.queriesExecuted++;
      const sql = String(args?.sql_query || '');
      const rawRows = await executeQuery(sql);
      const maskedRows = rawRows.map(row => engine.maskObject(row));
      return {
        content: [{ type: 'text', text: JSON.stringify(maskedRows, null, 2) }]
      };
    } else if (name === 'unmask_text') {
      metrics.textUnmasked++;
      const maskedText = String(args?.masked_text || '');
      const restoredText = engine.unmask(maskedText);
      return {
        content: [{ type: 'text', text: restoredText }]
      };
    } else if (name === 'add_to_roster') {
      const names = Array.isArray(args?.names) ? args.names : [];
      engine.addRosterNames(names);
      return {
        content: [{ type: 'text', text: `Successfully added ${names.length} names to active roster.` }]
      };
    } else {
      throw new Error('Unknown tool: ' + name);
    }
  } catch (err: any) {
    return {
      isError: true,
      content: [{ type: 'text', text: err.message || 'Unknown execution error' }]
    };
  }
});

async function main() {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  if (isSse) {
    // Start SSE server
    const app = express();
    app.use(express.json());

    // API Key Authentication Middleware
    if (apiKey) {
      app.use((req, res, next) => {
        const clientKey = req.headers['x-api-key'] || req.query['api_key'];
        if (clientKey !== apiKey) {
          res.status(401).send('Unauthorized: Invalid API Key');
          return;
        }
        next();
      });
    }

    app.get('/sse', async (req, res) => {
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      console.log(`New client connection requested on /sse from ${clientIp}`);

      const transport = new SSEServerTransport('/message', res);
      await server.connect(transport);

      const sessionId = transport.sessionId;
      activeTransports.set(sessionId, transport);
      metrics.totalConnections++;
      metrics.uniqueIPs.add(clientIp);

      console.log(`Client session established: ${sessionId} (Active: ${activeTransports.size})`);

      req.on('close', () => {
        activeTransports.delete(sessionId);
        console.log(`Client session disconnected: ${sessionId} (Active: ${activeTransports.size})`);
      });
    });

    app.post('/message', async (req, res) => {
      const sessionId = String(req.query.sessionId || '');
      const transport = activeTransports.get(sessionId);
      if (transport) {
        await transport.handlePostMessage(req, res);
      } else {
        res.status(400).send('No active SSE session for this sessionId');
      }
    });

    app.get('/stats', (req, res) => {
      res.json({
        activeConnectionsCount: activeTransports.size,
        totalConnectionsCount: metrics.totalConnections,
        uniqueUsersCount: metrics.uniqueIPs.size,
        queriesExecutedCount: metrics.queriesExecuted,
        textUnmaskedCount: metrics.textUnmasked
      });
    });

    app.listen(port, () => {
      console.log(`PII Shield MCP Server listening on port ${port} over SSE transport.`);
    });
  } else {
    // Start Stdio server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('PII Shield MCP Server running over Stdio transport.');
  }
}

main().catch(err => {
  console.error('Failed to run MCP server transport: ', err);
  process.exit(1);
});
