const Database = require('better-sqlite3');
const path = require('path');

// Determine which database to use
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'users.db')
  : path.join(process.cwd(), 'dev-users.db');

console.log('Checking database:', dbPath);

const db = new Database(dbPath);

try {
  // Get table schema
  console.log('\n=== Table Schema ===');
  const tableInfo = db.prepare("PRAGMA table_info(grace_price_conversion)").all();
  console.table(tableInfo);

  // Get indexes
  console.log('\n=== Indexes ===');
  const indexes = db.prepare("PRAGMA index_list(grace_price_conversion)").all();
  console.table(indexes);

  // Get table creation SQL
  console.log('\n=== Table Creation SQL ===');
  const createSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='grace_price_conversion'").get();
  console.log(createSql.sql);

  // Test inserting duplicates
  console.log('\n=== Testing Duplicate Insertion ===');
  
  const testKey = 'Test-Program-Category-Tier';
  
  // Try to insert first record
  db.prepare(`
    INSERT INTO grace_price_conversion (event_type, event_type_key, venue, jpy_price, eur_price)
    VALUES (?, ?, ?, ?, ?)
  `).run('Test Program', testKey, 'Venue', 1000, 10);
  console.log('✅ First record inserted');

  // Try to insert duplicate
  db.prepare(`
    INSERT INTO grace_price_conversion (event_type, event_type_key, venue, jpy_price, eur_price)
    VALUES (?, ?, ?, ?, ?)
  `).run('Test Program 2', testKey, 'Venue', 2000, 20);
  console.log('✅ Duplicate record inserted successfully!');

  // Count duplicates
  const count = db.prepare('SELECT COUNT(*) as count FROM grace_price_conversion WHERE event_type_key = ?').get(testKey);
  console.log(`Total records with key "${testKey}": ${count.count}`);

  // Clean up test records
  db.prepare('DELETE FROM grace_price_conversion WHERE event_type_key = ?').run(testKey);
  console.log('✅ Test records cleaned up');

  console.log('\n🎉 Database schema verification complete! Duplicates are now allowed.');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
