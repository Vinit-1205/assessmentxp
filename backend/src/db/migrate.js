const fs = require('fs');
const path = require('path');
const db = require('./index');

async function migrate() {
  console.log('[migrate] Starting database initialization...');

  // 1. Enable pgcrypto (if not already enabled) and create auth schema + auth.users table
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE IF NOT EXISTS auth.users (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email               TEXT NOT NULL UNIQUE,
      password_hash       TEXT,
      is_verified         BOOLEAN NOT NULL DEFAULT false,
      verification_token  TEXT,
      verification_token_expires TIMESTAMPTZ,
      reset_token         TEXT,
      reset_token_expires TIMESTAMPTZ,
      raw_app_meta_data   JSONB DEFAULT '{}'::jsonb,
      raw_user_meta_data  JSONB DEFAULT '{}'::jsonb,
      created_at          TIMESTAMPTZ DEFAULT now(),
      updated_at          TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('[migrate] Created auth schema and auth.users table');

  // 2. Read and execute migration files
  const migrationFiles = [
    '001_initial_schema.sql',
    '008_results_reviewer_fields.sql',
    '009_certificate_brandings.sql',
    '010_add_is_released_to_results.sql'
  ];

  for (const filename of migrationFiles) {
    const filePath = path.join(__dirname, '../../../supabase/migrations', filename);
    console.log(`[migrate] Running migration file: ${filename}`);
    
    let sql = fs.readFileSync(filePath, 'utf8');
    
    // Clean up Supabase RLS specific commands if present in the migration files
    sql = sql.replace(/ALTER TABLE [\s\S]+? ENABLE ROW LEVEL SECURITY;/gi, '');
    sql = sql.replace(/ALTER TABLE [\s\S]+? DISABLE ROW LEVEL SECURITY;/gi, '');

    await db.query(sql);
  }

  console.log('[migrate] All migrations executed successfully.');
}

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrate;
