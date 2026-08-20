# PII Shield Database MCP Server

A polished Model Context Protocol (MCP) server that provides secure PostgreSQL database query execution with automatic Personally Identifiable Information (PII) masking. It allows LLM agents to query databases while ensuring compliance with GDPR, PDPA, and data privacy principles.

## Features

- **Auto-Masking Interceptor**: Intercepts Postgres SELECT query results and dynamically masks PII using hybrid schema and content-level scanning.

- **In-Memory TTL Cache**: Stores pseudonymized tokens (e.g. `__PERSON_A__`, `__EMAIL_1__`) with an expiration TTL (default: 30 minutes) to prevent memory growth.

- **Read-Only SQL Safety Filter**: Automatically rejects mutation queries (INSERT, UPDATE, DELETE, etc.) to prevent data alterations.

- **Bi-directional Unmasking**: Exposes tools to restore masked placeholders in the final response returned to users.

- **Zero-Trust Connection**: Works by injecting environment variables or CLI flags during process startup, preventing LLMs from seeing or handling database credentials.

## Installation

Ensure you have Node.js (v18+) and npm installed.

1. Navigate to the server folder:

   ```bash
   cd mcp-pii-shield
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Compile the TypeScript codebase:

   ```bash
   npm run build
   ```

## Running the Server

The server starts using standard Stdio transport:

```bash
node dist/index.js --db-uri "postgresql://postgres:password@localhost:5432/your_database"
```

### Configuration Options

#### Environment Variables

- `PGHOST` (default: localhost)
- `PGPORT` (default: 5432)
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `ROSTER_PATH` (default: ./entityRoster.json)
- `CACHE_TTL_SEC` (default: 1800)

#### CLI Flags

- `--db-uri`: PostgreSQL connection URL (e.g. `postgresql://user:pass@host:port/dbname`)
- `--roster-path`: Path to name roster JSON file
- `--ttl`: Token cache TTL in seconds

## MCP Tools Exposed

1. `run_secure_query(sql_query)`: Execute a SELECT query on the Postgres database. PII values in results will be automatically replaced with placeholders.

2. `unmask_text(masked_text)`: Restore the original raw values in a text block containing placeholders.

3. `add_to_roster(names)`: Dynamically register names to be scanned for PII.

## Integration Guides

### Claude Code CLI

Add to `~/.claudecode/config.json`:

```json
{
  "mcpServers": {
    "pii-shield-db": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-pii-shield/dist/index.js"],
      "env": {
        "PGHOST": "127.0.0.1",
        "PGPORT": "5432",
        "PGUSER": "postgres",
        "PGPASSWORD": "your_secure_password",
        "PGDATABASE": "your_pgdb_name",
        "ROSTER_PATH": "/absolute/path/to/mcp-pii-shield/entityRoster.json"
      }
    }
  }
}
```

### Cursor

Add a new MCP server in Cursor Settings -> Features -> MCP:

- **Name**: `pii-shield-db`

- **Type**: `stdio`

- **Command**: `node /absolute/path/to/mcp-pii-shield/dist/index.js --db-uri postgresql://postgres:your_secure_password@localhost:5432/your_pgdb_name --roster-path /absolute/path/to/mcp-pii-shield/entityRoster.json`

### VS Code (Cline / Roo Code)

Add to your client settings JSON file:

```json
{
  "mcpServers": {
    "pii-shield-db": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-pii-shield/dist/index.js",
        "--db-uri", "postgresql://postgres:your_secure_password@localhost:5432/your_pgdb_name"
      ]
    }
  }
}
```
