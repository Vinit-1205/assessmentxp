const { Pool } = require('pg');

// Use DATABASE_URL connection string if available, otherwise fallback to standard environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString && !process.env.PGHOST) {
  throw new Error("DATABASE_URL or PGHOST environment variable is required");
}

const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.PGHOST,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'postgres',
        port: parseInt(process.env.PGPORT || '5432', 10),
      }
);

pool.on('error', (err) => {
  console.error('[pg pool] Unexpected error on idle client:', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
