const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// Set up the environment
const envPath = path.join(process.cwd(), '.env.local');
require('dotenv').config({ path: envPath });

// Initialize SQLite database
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'users.db')
  : path.join(process.cwd(), 'dev-users.db');

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

function initializeTables() {
  // Create users table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      provider TEXT DEFAULT 'credentials',
      last_active_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  // Fee parameters table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS fee_params (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program TEXT NOT NULL,
      category TEXT NOT NULL,
      venue TEXT NOT NULL,
      attendance TEXT NOT NULL,
      percent REAL NOT NULL,
      concat_key TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  // Grace price conversion table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS grace_price_conversion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      event_type_key TEXT NOT NULL UNIQUE,
      jpy_price REAL NOT NULL,
      eur_price REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  // Other tables
  db.prepare(`
    CREATE TABLE IF NOT EXISTS trainer_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prod_id INTEGER NOT NULL,
      row_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      percent REAL NOT NULL,
      trainer_fee REAL NOT NULL DEFAULT 0,
      cash_received REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(prod_id, row_id)
    )
  `).run();
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prod_id INTEGER NOT NULL,
      row_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(prod_id, row_id)
    )
  `).run();
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      prod_id INTEGER NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  
  // Create indexes
  db.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)').run();
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_concat ON fee_params(concat_key)').run();
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_grace_price_event_type_key ON grace_price_conversion(event_type_key)').run();
}

function seedGracePrices() {
  const defaultData = [
    { eventType: 'Salsation Training - Repeater', eventTypeKey: 'Salsation-Instructor training-Repeater', jpyPrice: 19400, eurPrice: 113.449 },
    { eventType: 'Salsation Training - Troupe', eventTypeKey: 'Salsation-Instructor training-Troupe', jpyPrice: 19400, eurPrice: 113.449 },
    { eventType: 'Salsation Training - Early Bird', eventTypeKey: 'Salsation-Instructor training-Early Bird', jpyPrice: 29700, eurPrice: 173.685 },
    { eventType: 'Salsation Training - Regular', eventTypeKey: 'Salsation-Instructor training-Regular', jpyPrice: 36100, eurPrice: 211.11 },
    { eventType: 'Salsation Training - Rush', eventTypeKey: 'Salsation-Instructor training-Rush', jpyPrice: 42600, eurPrice: 249.12 },
    { eventType: 'Salsation Training - Free', eventTypeKey: 'Salsation-Instructor training-', jpyPrice: 0, eurPrice: 0 },
    { eventType: 'Choreology Training - Repeater', eventTypeKey: 'Choreology-Instructor training-Repeater', jpyPrice: 19400, eurPrice: 113.449 },
    { eventType: 'Choreology Training - Trouper', eventTypeKey: 'Choreology-Instructor training-Troupe', jpyPrice: 19400, eurPrice: 113.449 },
    { eventType: 'Choreology Training - Early Bird', eventTypeKey: 'Choreology-Instructor training-Early Bird', jpyPrice: 29700, eurPrice: 173.685 },
    { eventType: 'Choreology Training - Regular', eventTypeKey: 'Choreology-Instructor training-Regular', jpyPrice: 36100, eurPrice: 211.11 },
    { eventType: 'Choreology Training - Rush', eventTypeKey: 'Choreology-Instructor training-Rush', jpyPrice: 42600, eurPrice: 249.12 },
    { eventType: 'Choreology Training - Free', eventTypeKey: 'Choreology-Instructor training-', jpyPrice: 0, eurPrice: 0 },
    { eventType: 'KID Instructor Training - Repeater', eventTypeKey: 'Kid-Instructor training-Repeater', jpyPrice: 19400, eurPrice: 113.449 },
    { eventType: 'KID Instructor Training - Trouper', eventTypeKey: 'Kid-Instructor training-Troupe', jpyPrice: 19400, eurPrice: 113.449 },
    { eventType: 'KID Instructor Training - Early Bird', eventTypeKey: 'Kid-Instructor training-Early Bird', jpyPrice: 29700, eurPrice: 173.685 },
    { eventType: 'KID Instructor Training - Regular', eventTypeKey: 'Kid-Instructor training-Regular', jpyPrice: 36100, eurPrice: 211.11 },
    { eventType: 'KID Instructor Training - Rush', eventTypeKey: 'Kid-Instructor training-Rush', jpyPrice: 42600, eurPrice: 249.12 },
    { eventType: 'KID Instructor Training - Free', eventTypeKey: 'Kid-Instructor training-', jpyPrice: 0, eurPrice: 0 },
  ];
  
  const insert = db.prepare(`
    INSERT OR IGNORE INTO grace_price_conversion (event_type, event_type_key, jpy_price, eur_price) 
    VALUES (?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const item of defaultData) {
    const result = insert.run(item.eventType, item.eventTypeKey, item.jpyPrice, item.eurPrice);
    if (result.changes > 0) count++;
  }
  
  return count;
}

function seedFeeParams() {
  const feeParams = [
    { concat: 'Salsation-Instructor training-Venue-Attended', percent: 70 },
    { concat: 'Salsation-Instructor training-Online-Attended', percent: 65 },
    { concat: 'Salsation-Instructor training-OnlineGlobal-Attended', percent: 60 },
    { concat: 'Choreology-Instructor training-Venue-Attended', percent: 70 },
    { concat: 'Choreology-Instructor training-Online-Attended', percent: 65 },
    { concat: 'Kid-Instructor training-Venue-Attended', percent: 70 },
    { concat: 'Kid-Instructor training-Online-Attended', percent: 65 },
    { concat: 'Salsation-Workshops-Venue-Attended', percent: 75 },
    { concat: 'Salsation-Workshops-Online-Attended', percent: 70 },
    { concat: 'Rootz-Instructor training-Venue-Attended', percent: 70 },
    { concat: 'Natasha_Salsation-Instructor training-Venue-Attended', percent: 70 },
  ];
  
  const insert = db.prepare(`
    INSERT OR IGNORE INTO fee_params (program, category, venue, attendance, percent, concat_key) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const param of feeParams) {
    const [program, category, venue, attendance] = param.concat.split('-');
    const result = insert.run(program, category, venue, attendance, param.percent, param.concat);
    if (result.changes > 0) count++;
  }
  
  return count;
}

async function seedUsers() {
  const demoUsers = [
    { email: 'admin@salsation.com', name: 'Admin User', role: 'admin', password: 'admin123' },
    { email: 'finance@salsation.com', name: 'Finance User', role: 'finance', password: 'finance123' },
    { email: 'trainer@salsation.com', name: 'Trainer User', role: 'trainer', password: 'trainer123' },
    { email: 'viewer@salsation.com', name: 'Viewer User', role: 'viewer', password: 'viewer123' },
  ];
  
  const findUser = db.prepare('SELECT * FROM users WHERE email = ?');
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, name, password, role, provider)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  let count = 0;
  for (const user of demoUsers) {
    const existingUser = findUser.get(user.email);
    if (!existingUser) {
      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const hashedPassword = await bcrypt.hash(user.password, 12);
      
      insertUser.run(id, user.email, user.name, hashedPassword, user.role, 'credentials');
      console.log(`   ✓ Created user: ${user.email} (${user.role})`);
      count++;
    } else {
      console.log(`   ~ User already exists: ${user.email}`);
    }
  }
  
  return count;
}

async function seedSQLiteData() {
  try {
    console.log('🗄️  Seeding SQLite app-specific data...\n');
    
    // Initialize tables first
    console.log('🏗️  Initializing database tables...');
    initializeTables();
    console.log('✅ Tables initialized\n');
    
    console.log('📊 Seeding Grace Price Conversions...');
    const gracePriceCount = seedGracePrices();
    console.log(`✅ Grace Price Conversions: ${gracePriceCount} new entries added\n`);
    
    console.log('💰 Seeding Fee Parameters...');
    const feeParamCount = seedFeeParams();
    console.log(`✅ Fee Parameters: ${feeParamCount} new entries added\n`);
    
    console.log('👥 Seeding Demo Users...');
    const userCount = await seedUsers();
    console.log(`\n✅ Demo Users: ${userCount} new users created\n`);
    
    console.log('🎉 SQLite seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   • Grace Price Conversions: ${gracePriceCount} new entries`);
    console.log(`   • Fee Parameters: ${feeParamCount} new entries`);
    console.log(`   • Demo Users: ${userCount} new accounts`);
    console.log('\n🚀 You can now start the development server: npm run dev');
    
    // Close the database
    db.close();
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    console.error('\nStack trace:', error.stack);
    db.close();
    process.exit(1);
  }
}

// Run the seeding
seedSQLiteData();