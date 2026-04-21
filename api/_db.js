import './_env.js';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn('[db] DATABASE_URL not configured');
}

export const sql = url ? neon(url) : null;

export function requireDb() {
  if (!sql) throw new Error('DATABASE_URL not configured');
  return sql;
}
