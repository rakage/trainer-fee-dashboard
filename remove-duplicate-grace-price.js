require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DATABASE,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

async function removeDuplicate() {
  try {
    console.log('Checking for duplicate Early Bird entries...');
    
    const checkResult = await pool.query(`
      SELECT * FROM grace_price_conversion 
      WHERE event_type_key = 'Salsation-Instructor training-Early Bird'
      ORDER BY id
    `);
    
    console.log(`\nFound ${checkResult.rows.length} entries:`);
    checkResult.rows.forEach(row => {
      console.log(`  ID ${row.id}: ¥${row.jpy_price} = €${row.eur_price} (created: ${row.created_at})`);
    });
    
    if (checkResult.rows.length > 1) {
      // Delete ID 35 (the incorrect duplicate)
      console.log('\nDeleting duplicate entry (ID 35: ¥25,000 = €170)...');
      const deleteResult = await pool.query(`
        DELETE FROM grace_price_conversion 
        WHERE id = 35
      `);
      console.log(`Deleted ${deleteResult.rowCount} row(s).`);
      
      // Verify
      const verifyResult = await pool.query(`
        SELECT * FROM grace_price_conversion 
        WHERE event_type_key = 'Salsation-Instructor training-Early Bird'
        ORDER BY id
      `);
      
      console.log(`\nRemaining entries: ${verifyResult.rows.length}`);
      verifyResult.rows.forEach(row => {
        console.log(`  ID ${row.id}: ¥${row.jpy_price} = €${row.eur_price}`);
      });
    } else {
      console.log('\nNo duplicates found (already cleaned up).');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

removeDuplicate();
