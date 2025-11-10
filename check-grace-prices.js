require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

async function checkGracePrices() {
  try {
    const result = await pool.query(`
      SELECT * FROM grace_price_conversion 
      WHERE event_type_key LIKE '%Early Bird%' 
      ORDER BY jpy_price
    `);
    
    console.log('Early Bird entries in Grace Price Conversion:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkGracePrices();
