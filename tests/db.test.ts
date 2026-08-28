import { describe, it, expect, vi } from 'vitest';
import { executeQuery } from '../src/db.js';
import pg from 'pg';

const mockQuery = vi.fn();

// Mock the pg module to control query resolution and prevent real network connections
vi.mock('pg', () => {
  class MockPool {
    query = mockQuery;
    end = vi.fn().mockResolvedValue(undefined);
  }
  return {
    default: {
      Pool: MockPool,
    },
  };
});

describe('db.ts SQL validation', () => {
  it('should execute valid read-only SELECT queries', async () => {
    // Simulate successful database execution returning a mock row
    mockQuery.mockResolvedValueOnce({ rows: [{ col: 1 }] });

    const result = await executeQuery('SELECT 1');
    expect(result).toEqual([{ col: 1 }]);
    expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
  });

  it('should reject mutations and non-select queries', async () => {
    await expect(executeQuery('INSERT INTO users VALUES (1)')).rejects.toThrow(/Security Breach: Only read-only SELECT queries are allowed/i);
    await expect(executeQuery('DELETE FROM users')).rejects.toThrow(/Security Breach: Only read-only SELECT queries are allowed/i);
    await expect(executeQuery('DROP TABLE users')).rejects.toThrow(/Security Breach: Only read-only SELECT queries are allowed/i);
  });
});
