const path = require('path');
const Database = require('better-sqlite3');

// Initialize SQLite database
const dbPath = path.join(process.cwd(), 'dev-users.db');
const db = new Database(dbPath);

try {
  console.log('📊 Adding Grace Price Conversion records...\n');

  const insert = db.prepare(`
    INSERT OR REPLACE INTO grace_price_conversion 
    (event_type, event_type_key, venue, jpy_price, eur_price, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  const records = [
    {
      eventType: 'Online Workshop 2H - Trouper',
      eventTypeKey: 'Salsation-Workshops-Troupe-Online',
      venue: 'Online',
      jpyPrice: 4.617,
      eurPrice: 27
    },
    {
      eventType: 'Online Workshop 2H - Early Bird',
      eventTypeKey: 'Salsation-Workshops-Early Bird-Online',
      venue: 'Online',
      jpyPrice: 5.130,
      eurPrice: 30
    },
    {
      eventType: 'Online Workshop 2H - Regular',
      eventTypeKey: 'Salsation-Workshops-Regular-Online',
      venue: 'Online',
      jpyPrice: 5.632,
      eurPrice: 33
    },
    {
      eventType: 'Online Workshop 2H - Rush',
      eventTypeKey: 'Salsation-Workshops-Rush-Online',
      venue: 'Online',
      jpyPrice: 5.983,
      eurPrice: 35
    }
  ];

  let count = 0;
  for (const record of records) {
    const result = insert.run(
      record.eventType,
      record.eventTypeKey,
      record.venue,
      record.jpyPrice,
      record.eurPrice
    );
    if (result.changes > 0) {
      console.log(`✓ Added: ${record.eventType}`);
      count++;
    }
  }

  console.log(`\n✅ Successfully added ${count} Grace Price Conversion record(s)`);

  // Verify the records were added
  const verify = db.prepare(`
    SELECT event_type, event_type_key, venue, jpy_price, eur_price 
    FROM grace_price_conversion 
    WHERE venue = 'Online' AND event_type LIKE 'Online Workshop%'
  `);
  
  const results = verify.all();
  console.log('\n📋 Verification - Added records:');
  results.forEach(row => {
    console.log(`   ${row.event_type} | ${row.event_type_key} | ${row.venue} | JPY: ${row.jpy_price} | EUR: ${row.eur_price}`);
  });

} catch (error) {
  console.error('❌ Error adding records:', error);
  process.exit(1);
} finally {
  db.close();
}
