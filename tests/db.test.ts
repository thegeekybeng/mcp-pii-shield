import { describe, it, expect } from 'vitest';
import { executeQuery } from '../src/db.js';

describe('db.ts SQL validation', () => {
  it('should execute valid read-only SELECT queries', async () => {
    // Expected to reject with a connection/pool error since no PG config is provided, 
    // but should pass the query safety parser checks.
    await expect(executeQuery('SELECT 1')).rejects.toThrow(/database|connect/i);
  });

  it('should reject mutations and non-select queries', async () => {
    await expect(executeQuery('INSERT INTO users VALUES (1)')).rejects.toThrow(/Security Breach: Only read-only SELECT queries are allowed/i);
    await expect(executeQuery('DELETE FROM users')).rejects.toThrow(/Security Breach: Only read-only SELECT queries are allowed/i);
    await expect(executeQuery('DROP TABLE users')).rejects.toThrow(/Security Breach: Only read-only SELECT queries are allowed/i);
  });
});
