const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(process.cwd(), 'dev-users.db');
const db = new Database(dbPath);

console.log('🔍 Verifying GraceKey (event_type_key) Matching Logic\n');
console.log('═══════════════════════════════════════════════════════════\n');

try {
  // Get all grace price conversions
  const conversions = db.prepare(`
    SELECT event_type_key, venue, jpy_price, eur_price 
    FROM grace_price_conversion 
    ORDER BY venue, event_type_key
  `).all();

  console.log(`📊 Total conversion records: ${conversions.length}\n`);

  // Group by venue
  const venueRecords = conversions.filter(r => r.venue === 'Venue' || r.venue === null);
  const onlineRecords = conversions.filter(r => r.venue === 'Online');

  console.log('🏢 VENUE (In-Person) Events');
  console.log('─────────────────────────────────────────────────────────');
  console.log('These match tickets with: Country = Japan AND Location = Venue\n');
  
  venueRecords.forEach(record => {
    const hasOnlineSuffix = record.event_type_key.endsWith('-Online');
    const status = hasOnlineSuffix ? '⚠️  WARNING: Has -Online suffix' : '✓';
    console.log(`${status} ${record.event_type_key}`);
    console.log(`   JPY: ¥${record.jpy_price.toLocaleString()} | EUR: €${record.eur_price}`);
  });

  console.log('\n💻 ONLINE Events');
  console.log('─────────────────────────────────────────────────────────');
  console.log('These match tickets with: Country = Japan AND Location = Online\n');
  
  onlineRecords.forEach(record => {
    const hasOnlineSuffix = record.event_type_key.endsWith('-Online');
    const status = hasOnlineSuffix ? '✓' : '⚠️  WARNING: Missing -Online suffix';
    console.log(`${status} ${record.event_type_key}`);
    console.log(`   JPY: ¥${record.jpy_price.toLocaleString()} | EUR: €${record.eur_price}`);
  });

  // Validation checks
  console.log('\n🔍 VALIDATION CHECKS');
  console.log('─────────────────────────────────────────────────────────\n');

  const venueWithOnline = venueRecords.filter(r => r.event_type_key.endsWith('-Online'));
  const onlineWithoutSuffix = onlineRecords.filter(r => !r.event_type_key.endsWith('-Online'));

  if (venueWithOnline.length > 0) {
    console.log(`❌ Found ${venueWithOnline.length} Venue record(s) with -Online suffix:`);
    venueWithOnline.forEach(r => console.log(`   - ${r.event_type_key}`));
    console.log('   Fix: Change venue to "Online" or remove -Online suffix\n');
  }

  if (onlineWithoutSuffix.length > 0) {
    console.log(`❌ Found ${onlineWithoutSuffix.length} Online record(s) without -Online suffix:`);
    onlineWithoutSuffix.forEach(r => console.log(`   - ${r.event_type_key}`));
    console.log('   Fix: Add -Online suffix to event_type_key\n');
  }

  if (venueWithOnline.length === 0 && onlineWithoutSuffix.length === 0) {
    console.log('✅ All records are correctly formatted!');
    console.log('   - Venue records do not have -Online suffix');
    console.log('   - Online records have -Online suffix\n');
  }

  // Show example ticket matching
  console.log('\n📋 EXAMPLE TICKET MATCHING SCENARIOS');
  console.log('─────────────────────────────────────────────────────────\n');

  console.log('Scenario 1: Venue Event Ticket');
  console.log('  Ticket Data:');
  console.log('    - Country: Japan');
  console.log('    - Location: Venue');
  console.log('    - Program: Salsation');
  console.log('    - Category: Workshops');
  console.log('    - TierLevel: Regular');
  console.log('  Generated GraceKey: Salsation-Workshops-Regular');
  
  const venueMatch = db.prepare(`
    SELECT * FROM grace_price_conversion 
    WHERE event_type_key = 'Salsation-Workshops-Regular'
  `).get();
  
  if (venueMatch) {
    console.log(`  ✓ Match found: JPY ¥${venueMatch.jpy_price} | EUR €${venueMatch.eur_price}`);
  } else {
    console.log('  ✗ No match found - need to add this conversion rate');
  }

  console.log('\nScenario 2: Online Event Ticket');
  console.log('  Ticket Data:');
  console.log('    - Country: Japan');
  console.log('    - Location: Online');
  console.log('    - Program: Salsation');
  console.log('    - Category: Workshops');
  console.log('    - TierLevel: Regular');
  console.log('  Generated GraceKey: Salsation-Workshops-Regular-Online');
  
  const onlineMatch = db.prepare(`
    SELECT * FROM grace_price_conversion 
    WHERE event_type_key = 'Salsation-Workshops-Regular-Online'
  `).get();
  
  if (onlineMatch) {
    console.log(`  ✓ Match found: JPY ¥${onlineMatch.jpy_price} | EUR €${onlineMatch.eur_price}`);
  } else {
    console.log('  ✗ No match found - need to add this conversion rate');
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ Verification complete!\n');

} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  db.close();
}
