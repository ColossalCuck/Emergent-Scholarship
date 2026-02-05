// Run database migration
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Running migration: Add api_key_hash and description columns...');
  
  try {
    await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key_hash text`;
    console.log('✓ Added api_key_hash column');
    
    await sql`ALTER TABLE agents ADD COLUMN IF NOT EXISTS description text`;
    console.log('✓ Added description column');
    
    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
