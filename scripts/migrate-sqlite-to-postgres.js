#!/usr/bin/env node

/**
 * SQLite to PostgreSQL Migration Script
 * 
 * This script migrates all data from SQLite to PostgreSQL.
 * 
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.js
 *   npm run migrate:postgres
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

// PostgreSQL connection
const pgConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
};

console.log('🔧 PostgreSQL Configuration:');
console.log(`   Host: ${pgConfig.host}`);
console.log(`   Port: ${pgConfig.port}`);
console.log(`   Database: ${pgConfig.database}`);
console.log(`   User: ${pgConfig.user}`);

// SQLite connection
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '../users.db') 
  : path.join(__dirname, '../dev-users.db');

console.log(`📂 SQLite Database: ${dbPath}`);

const sqlite = new Database(dbPath);
const pgPool = new Pool(pgConfig);

async function createPostgresSchema() {
  console.log('\n📋 Creating PostgreSQL schema...');
  
  const client = await pgPool.connect();
  
  try {
    await client.query('BEGIN');

    // Drop existing tables if they exist (in reverse order of dependencies)
    console.log('   Dropping existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS audit_log CASCADE;
      DROP TABLE IF EXISTS expenses CASCADE;
      DROP TABLE IF EXISTS trainer_splits CASCADE;
      DROP TABLE IF EXISTS grace_price_conversion CASCADE;
      DROP TABLE IF EXISTS param_reporting_grp CASCADE;
      DROP TABLE IF EXISTS fee_params CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create users table
    console.log('   Creating users table...');
    await client.query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'viewer',
        provider TEXT DEFAULT 'credentials',
        last_active_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_role ON users(role);
    `);

    // Create fee_params table
    console.log('   Creating fee_params table...');
    await client.query(`
      CREATE TABLE fee_params (
        id SERIAL PRIMARY KEY,
        program TEXT NOT NULL,
        category TEXT NOT NULL,
        venue TEXT NOT NULL,
        attendance TEXT NOT NULL,
        percent REAL NOT NULL,
        concat_key TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE UNIQUE INDEX idx_fee_concat ON fee_params(concat_key);
    `);

    // Create trainer_splits table
    console.log('   Creating trainer_splits table...');
    await client.query(`
      CREATE TABLE trainer_splits (
        id SERIAL PRIMARY KEY,
        prod_id INTEGER NOT NULL,
        row_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        percent REAL NOT NULL,
        trainer_fee REAL NOT NULL DEFAULT 0,
        cash_received REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(prod_id, row_id)
      );
      
      CREATE INDEX idx_trainer_splits_prod_id ON trainer_splits(prod_id);
    `);

    // Create expenses table
    console.log('   Creating expenses table...');
    await client.query(`
      CREATE TABLE expenses (
        id SERIAL PRIMARY KEY,
        prod_id INTEGER NOT NULL,
        row_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(prod_id, row_id)
      );
      
      CREATE INDEX idx_expenses_prod_id ON expenses(prod_id);
    `);

    // Create audit_log table
    console.log('   Creating audit_log table...');
    await client.query(`
      CREATE TABLE audit_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        prod_id INTEGER NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_audit_log_prod_id ON audit_log(prod_id);
    `);

    // Create grace_price_conversion table
    console.log('   Creating grace_price_conversion table...');
    await client.query(`
      CREATE TABLE grace_price_conversion (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_type_key TEXT NOT NULL,
        venue TEXT,
        jpy_price REAL NOT NULL,
        eur_price REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_grace_price_event_type_key ON grace_price_conversion(event_type_key);
    `);

    // Create param_reporting_grp table
    console.log('   Creating param_reporting_grp table...');
    await client.query(`
      CREATE TABLE param_reporting_grp (
        id SERIAL PRIMARY KEY,
        reporting_group TEXT NOT NULL UNIQUE,
        split TEXT NOT NULL,
        trainer_percent REAL NOT NULL,
        alejandro_percent REAL NOT NULL,
        price REAL,
        repeater_price REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE UNIQUE INDEX idx_param_reporting_grp_name ON param_reporting_grp(reporting_group);
    `);

    await client.query('COMMIT');
    console.log('✅ PostgreSQL schema created successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function migrateTable(tableName, columns, transformRow = null) {
  console.log(`\n📊 Migrating ${tableName}...`);
  
  const client = await pgPool.connect();
  
  try {
    // Get data from SQLite
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    
    if (rows.length === 0) {
      console.log(`   No data to migrate for ${tableName}`);
      return 0;
    }

    console.log(`   Found ${rows.length} rows`);

    // Prepare insert statement
    const columnList = columns.join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`;

    await client.query('BEGIN');

    let migrated = 0;
    for (const row of rows) {
      try {
        // Transform row if needed
        const values = transformRow ? transformRow(row, columns) : columns.map(col => {
          // Convert SQLite column name to row key
          const key = col.replace(/_([a-z])/g, (g) => g[1].toUpperCase()).replace(/_/g, '');
          let value = row[col] || row[key];
          
          // Convert datetime strings to proper format
          if (col.includes('_at') && value) {
            value = new Date(value);
          }
          
          return value !== undefined ? value : null;
        });

        await client.query(insertQuery, values);
        migrated++;
      } catch (error) {
        console.error(`   Error migrating row:`, row);
        console.error(`   Error:`, error.message);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Migrated ${migrated} rows to ${tableName}`);
    return migrated;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`❌ Error migrating ${tableName}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function migrateUsers() {
  return migrateTable(
    'users',
    ['id', 'email', 'name', 'password', 'role', 'provider', 'last_active_at', 'created_at', 'updated_at'],
    (row, columns) => columns.map(col => {
      let value = row[col];
      if ((col === 'created_at' || col === 'updated_at' || col === 'last_active_at') && value) {
        value = new Date(value);
      }
      return value !== undefined ? value : null;
    })
  );
}

async function migrateFeeParams() {
  return migrateTable(
    'fee_params',
    ['program', 'category', 'venue', 'attendance', 'percent', 'concat_key', 'created_at', 'updated_at'],
    (row, columns) => columns.map(col => {
      let value = row[col];
      if ((col === 'created_at' || col === 'updated_at') && value) {
        value = new Date(value);
      }
      return value !== undefined ? value : null;
    })
  );
}

async function migrateTrainerSplits() {
  return migrateTable(
    'trainer_splits',
    ['prod_id', 'row_id', 'name', 'percent', 'trainer_fee', 'cash_received', 'created_at', 'updated_at'],
    (row, columns) => columns.map(col => {
      let value = row[col];
      if ((col === 'created_at' || col === 'updated_at') && value) {
        value = new Date(value);
      }
      return value !== undefined ? value : null;
    })
  );
}

async function migrateExpenses() {
  return migrateTable(
    'expenses',
    ['prod_id', 'row_id', 'description', 'amount', 'created_at', 'updated_at'],
    (row, columns) => columns.map(col => {
      let value = row[col];
      if ((col === 'created_at' || col === 'updated_at') && value) {
        value = new Date(value);
      }
      return value !== undefined ? value : null;
    })
  );
}

async function migrateAuditLog() {
  return migrateTable(
    'audit_log',
    ['user_id', 'action', 'prod_id', 'details', 'created_at'],
    (row, columns) => columns.map(col => {
      let value = row[col];
      if (col === 'created_at' && value) {
        value = new Date(value);
      }
      return value !== undefined ? value : null;
    })
  );
}

async function migrateGracePriceConversion() {
  return migrateTable(
    'grace_price_conversion',
    ['event_type', 'event_type_key', 'venue', 'jpy_price', 'eur_price', 'created_at', 'updated_at'],
    (row, columns) => columns.map(col => {
      let value = row[col];
      if ((col === 'created_at' || col === 'updated_at') && value) {
        value = new Date(value);
      }
      return value !== undefined ? value : null;
    })
  );
}

async function migrateParamReportingGrp() {
  return migrateTable(
    'param_reporting_grp',
    ['reporting_group', 'split', 'trainer_percent', 'alejandro_percent', 'price', 'repeater_price', 'created_at', 'updated_at'],
    (row, columns) => columns.map(col => {
      let value = row[col];
      if ((col === 'created_at' || col === 'updated_at') && value) {
        value = new Date(value);
      }
      return value !== undefined ? value : null;
    })
  );
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  const tables = [
    'users',
    'fee_params',
    'trainer_splits',
    'expenses',
    'audit_log',
    'grace_price_conversion',
    'param_reporting_grp'
  ];

  const client = await pgPool.connect();
  
  try {
    for (const table of tables) {
      const sqliteCount = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      const pgResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].count);
      
      const status = sqliteCount === pgCount ? '✅' : '⚠️';
      console.log(`   ${status} ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
    }
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    client.release();
  }
}

async function migrate() {
  console.log('🚀 Starting SQLite to PostgreSQL migration...\n');
  
  try {
    // Test PostgreSQL connection
    console.log('🔌 Testing PostgreSQL connection...');
    const testClient = await pgPool.connect();
    console.log('✅ PostgreSQL connection successful!');
    testClient.release();

    // Create schema
    await createPostgresSchema();

    // Migrate tables
    const stats = {
      users: await migrateUsers(),
      fee_params: await migrateFeeParams(),
      trainer_splits: await migrateTrainerSplits(),
      expenses: await migrateExpenses(),
      audit_log: await migrateAuditLog(),
      grace_price_conversion: await migrateGracePriceConversion(),
      param_reporting_grp: await migrateParamReportingGrp(),
    };

    // Verify migration
    await verifyMigration();

    console.log('\n📊 Migration Statistics:');
    for (const [table, count] of Object.entries(stats)) {
      console.log(`   ${table}: ${count} rows`);
    }

    console.log('\n✨ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update your code to use PostgreSQL instead of SQLite');
    console.log('   2. Test your application thoroughly');
    console.log('   3. Backup your SQLite database before removing it');

  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    throw error;
  } finally {
    sqlite.close();
    await pgPool.end();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('\n✅ Migration process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration process failed:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
