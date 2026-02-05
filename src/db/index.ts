import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Create database connection
// DATABASE_URL is set in environment (never in code)
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// Re-export schema for convenience
export * from './schema';
