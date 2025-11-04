const Database = require('better-sqlite3');
const path = require('path');

// Determine which database to use
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'users.db')
  : path.join(process.cwd(), 'dev-users.db');

console.log('Using database:', dbPath);

const db = new Database(dbPath);

try {
  console.log('Starting migration to allow duplicate grace price keys...');

  // Start transaction
  db.exec('BEGIN TRANSACTION');

  // Drop the unique index if it exists
  console.log('Dropping unique index...');
  db.prepare('DROP INDEX IF EXISTS idx_grace_price_event_type_key').run();

  // Create temporary table without UNIQUE constraint
  console.log('Creating temporary table...');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS grace_price_conversion_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_type_key TEXT NOT NULL,
      venue TEXT,
      jpy_price REAL NOT NULL,
      eur_price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Copy data from old table to new table
  console.log('Copying data...');
  db.prepare(`
    INSERT INTO grace_price_conversion_new (id, event_type, event_type_key, venue, jpy_price, eur_price, created_at, updated_at)
    SELECT id, event_type, event_type_key, venue, jpy_price, eur_price, created_at, updated_at
    FROM grace_price_conversion
  `).run();

  // Drop old table
  console.log('Dropping old table...');
  db.prepare('DROP TABLE grace_price_conversion').run();

  // Rename new table to original name
  console.log('Renaming new table...');
  db.prepare('ALTER TABLE grace_price_conversion_new RENAME TO grace_price_conversion').run();

  // Create non-unique index for performance
  console.log('Creating new index...');
  db.prepare('CREATE INDEX IF NOT EXISTS idx_grace_price_event_type_key ON grace_price_conversion(event_type_key)').run();

  // Commit transaction
  db.exec('COMMIT');

  console.log('✅ Migration completed successfully!');
  console.log('You can now add multiple grace price conversions with the same event_type_key.');

  // Show current records
  const records = db.prepare('SELECT COUNT(*) as count FROM grace_price_conversion').get();
  console.log(`\nTotal grace price records: ${records.count}`);

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
}
