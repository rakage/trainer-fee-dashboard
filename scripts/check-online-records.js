const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'dev-users.db');
const db = new Database(dbPath);

try {
  console.log('📊 Checking records with Online venue...\n');

  const results = db.prepare(`
    SELECT id, event_type, event_type_key, venue 
    FROM grace_price_conversion 
    WHERE venue = 'Online'
  `).all();

  console.log(`Found ${results.length} records with Online venue:\n`);
  
  results.forEach(row => {
    const hasOnlineSuffix = row.event_type_key.endsWith('-Online');
    const status = hasOnlineSuffix ? '✓' : '✗ (needs -Online suffix)';
    console.log(`${status} ID: ${row.id} | ${row.event_type_key}`);
  });

  // Check if any need updating
  const needsUpdate = results.filter(row => !row.event_type_key.endsWith('-Online'));
  
  if (needsUpdate.length > 0) {
    console.log(`\n⚠️  ${needsUpdate.length} record(s) need to have -Online suffix added to event_type_key`);
  } else {
    console.log('\n✅ All Online venue records have proper -Online suffix');
  }

} catch (error) {
  console.error('❌ Error:', error);
} finally {
  db.close();
}
