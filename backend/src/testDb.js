require('dotenv').config();
const db = require('./db/index');
const migrate = require('./db/migrate');

async function testConnection() {
  console.log('[testDb] Testing database connection...');
  try {
    const res = await db.query('SELECT now()');
    console.log('[testDb] Connection SUCCESSFUL! Database local time is:', res.rows[0].now);
    
    // Ask if we should run migration
    console.log('[testDb] Running migrations...');
    await migrate();
    console.log('[testDb] Migration run completed.');
  } catch (err) {
    console.error('[testDb] Connection FAILED.');
    console.error('Error message:', err.message);
    console.log('\n--- Troubleshooting database connection ---');
    console.log('Please make sure you have defined one of the following in backend/.env:');
    console.log('1. DATABASE_URL=postgresql://username:password@host:port/database');
    console.log('Or individually:');
    console.log('   PGHOST=your-database-host');
    console.log('   PGUSER=postgres');
    console.log('   PGPASSWORD=postgres');
    console.log('   PGPORT=5432');
    console.log('   PGDATABASE=postgres');
    console.log('-------------------------------------------\n');
  }
}

testConnection();
