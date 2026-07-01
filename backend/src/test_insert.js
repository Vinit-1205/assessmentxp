require('dotenv').config();
const db = require('./db/index');

async function test() {
  const sql = `INSERT INTO institutions (name, slug, country, phone) 
               VALUES ($1, $2, $3, $4) RETURNING *`;
  const params = ['Test Name', 'test-slug-' + Date.now(), 'USA', '1234'];
  
  try {
    const res = await db.query(sql, params);
    console.log('SUCCESS: Inserted rows length:', res.rows.length);
    console.log('Inserted Row:', res.rows[0]);
  } catch (err) {
    console.error('FAILED: SQL error:', err.message);
  }
}

test();
