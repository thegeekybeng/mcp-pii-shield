import pg from 'pg';

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    // Defaults to environment variables
    pool = new pg.Pool();
  }
  return pool;
}

export function initPool(config: pg.PoolConfig): void {
  if (pool) {
    pool.end().catch(err => console.error('Error ending connection pool:', err));
  }
  pool = new pg.Pool(config);
}

export async function executeQuery(sql: string): Promise<any[]> {
  const cleanSql = sql.trim();
  
  // Safety checks: strictly start with SELECT
  if (!/^select\b/i.test(cleanSql)) {
    throw new Error('Security Breach: Only read-only SELECT queries are allowed.');
  }

  // Mutation keywords check
  const forbiddenKeywords = /\b(insert|update|delete|drop|alter|truncate|create|replace|grant)\b/i;
  if (forbiddenKeywords.test(cleanSql)) {
    throw new Error('Security Breach: Only read-only SELECT queries are allowed.');
  }

  const p = getPool();
  const res = await p.query(cleanSql);
  return res.rows;
}
