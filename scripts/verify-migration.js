#!/usr/bin/env node

/**
 * Migration Verification Script
 * 
 * This script verifies that the PostgreSQL migration was successful
 * by comparing data between SQLite and PostgreSQL databases.
 * 
 * Usage:
 *   node scripts/verify-migration.js
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

// SQLite connection
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, '../users.db') 
  : path.join(__dirname, '../dev-users.db');

const sqlite = new Database(dbPath);
const pgPool = new Pool(pgConfig);

const tables = [
  'users',
  'fee_params',
  'trainer_splits',
  'expenses',
  'audit_log',
  'grace_price_conversion',
  'param_reporting_grp'
];

async function verifyTableCounts() {
  console.log('📊 Verifying table row counts...\n');
  
  const client = await pgPool.connect();
  let allMatch = true;
  
  try {
    for (const table of tables) {
      const sqliteCount = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
      const pgResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].count);
      
      const match = sqliteCount === pgCount;
      const status = match ? '✅' : '❌';
      
      console.log(`${status} ${table.padEnd(25)} SQLite: ${sqliteCount.toString().padStart(5)} | PostgreSQL: ${pgCount.toString().padStart(5)}`);
      
      if (!match) {
        allMatch = false;
      }
    }
  } finally {
    client.release();
  }
  
  return allMatch;
}

async function verifyUsersData() {
  console.log('\n\n👥 Verifying users data...\n');
  
  const client = await pgPool.connect();
  let allMatch = true;
  
  try {
    const sqliteUsers = sqlite.prepare('SELECT id, email, name, role FROM users ORDER BY id').all();
    const pgResult = await client.query('SELECT id, email, name, role FROM users ORDER BY id');
    const pgUsers = pgResult.rows;
    
    if (sqliteUsers.length !== pgUsers.length) {
      console.log('❌ User count mismatch!');
      allMatch = false;
    } else {
      for (let i = 0; i < sqliteUsers.length; i++) {
        const sqliteUser = sqliteUsers[i];
        const pgUser = pgUsers[i];
        
        if (sqliteUser.id !== pgUser.id || 
            sqliteUser.email !== pgUser.email || 
            sqliteUser.name !== pgUser.name || 
            sqliteUser.role !== pgUser.role) {
          console.log(`❌ User mismatch at index ${i}:`);
          console.log('   SQLite:', sqliteUser);
          console.log('   PostgreSQL:', pgUser);
          allMatch = false;
        }
      }
      
      if (allMatch) {
        console.log(`✅ All ${sqliteUsers.length} users match perfectly`);
      }
    }
  } finally {
    client.release();
  }
  
  return allMatch;
}

async function verifyFeeParamsData() {
  console.log('\n\n⚙️  Verifying fee_params data...\n');
  
  const client = await pgPool.connect();
  let allMatch = true;
  
  try {
    const sqliteParams = sqlite.prepare('SELECT program, category, venue, attendance, percent FROM fee_params ORDER BY concat_key').all();
    const pgResult = await client.query('SELECT program, category, venue, attendance, percent FROM fee_params ORDER BY concat_key');
    const pgParams = pgResult.rows;
    
    if (sqliteParams.length !== pgParams.length) {
      console.log('❌ Fee params count mismatch!');
      allMatch = false;
    } else {
      console.log(`✅ All ${sqliteParams.length} fee parameters match`);
    }
  } finally {
    client.release();
  }
  
  return allMatch;
}

async function verifyTrainerSplitsData() {
  console.log('\n\n💰 Verifying trainer_splits data...\n');
  
  const client = await pgPool.connect();
  let allMatch = true;
  
  try {
    const sqliteSplits = sqlite.prepare('SELECT prod_id, row_id, name, percent, trainer_fee, cash_received FROM trainer_splits ORDER BY prod_id, row_id').all();
    const pgResult = await client.query('SELECT prod_id, row_id, name, percent, trainer_fee, cash_received FROM trainer_splits ORDER BY prod_id, row_id');
    const pgSplits = pgResult.rows;
    
    if (sqliteSplits.length !== pgSplits.length) {
      console.log(`❌ Trainer splits count mismatch! SQLite: ${sqliteSplits.length}, PostgreSQL: ${pgSplits.length}`);
      allMatch = false;
    } else {
      console.log(`✅ All ${sqliteSplits.length} trainer splits match`);
    }
  } finally {
    client.release();
  }
  
  return allMatch;
}

async function checkPostgresIndexes() {
  console.log('\n\n🔍 Checking PostgreSQL indexes...\n');
  
  const client = await pgPool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        tablename, 
        indexname, 
        indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname
    `);
    
    console.log(`Found ${result.rows.length} indexes:`);
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}.${row.indexname}`);
    });
  } finally {
    client.release();
  }
}

async function checkPostgresConstraints() {
  console.log('\n\n🔒 Checking PostgreSQL constraints...\n');
  
  const client = await pgPool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        conrelid::regclass AS table_name,
        conname AS constraint_name,
        contype AS constraint_type
      FROM pg_constraint
      WHERE connamespace = 'public'::regnamespace
      ORDER BY conrelid::regclass::text, conname
    `);
    
    console.log(`Found ${result.rows.length} constraints:`);
    result.rows.forEach(row => {
      const type = {
        'p': 'PRIMARY KEY',
        'u': 'UNIQUE',
        'f': 'FOREIGN KEY',
        'c': 'CHECK'
      }[row.constraint_type] || row.constraint_type;
      
      console.log(`   ✓ ${row.table_name}.${row.constraint_name} (${type})`);
    });
  } finally {
    client.release();
  }
}

async function verify() {
  console.log('🔍 Starting migration verification...\n');
  console.log(`SQLite Database: ${dbPath}`);
  console.log(`PostgreSQL: ${pgConfig.user}@${pgConfig.host}:${pgConfig.port}/${pgConfig.database}\n`);
  console.log('='.repeat(80));
  
  try {
    // Test PostgreSQL connection
    console.log('\n🔌 Testing PostgreSQL connection...');
    const testClient = await pgPool.connect();
    console.log('✅ PostgreSQL connection successful!\n');
    testClient.release();

    // Verify data
    const countsMatch = await verifyTableCounts();
    const usersMatch = await verifyUsersData();
    const feeParamsMatch = await verifyFeeParamsData();
    const splitsMatch = await verifyTrainerSplitsData();
    
    // Check indexes and constraints
    await checkPostgresIndexes();
    await checkPostgresConstraints();

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 Verification Summary:\n');
    console.log(`   Table Counts:    ${countsMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Users Data:      ${usersMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Fee Params:      ${feeParamsMatch ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Trainer Splits:  ${splitsMatch ? '✅ PASS' : '❌ FAIL'}`);

    const allPass = countsMatch && usersMatch && feeParamsMatch && splitsMatch;
    
    if (allPass) {
      console.log('\n✨ Migration verification PASSED! All data migrated successfully.');
      console.log('\n📝 Next steps:');
      console.log('   1. Update your code to use PostgreSQL instead of SQLite');
      console.log('   2. Test your application thoroughly');
      console.log('   3. Keep SQLite backup for at least 2 weeks');
    } else {
      console.log('\n⚠️  Migration verification FAILED! Please review the errors above.');
      console.log('\n📝 Recommended actions:');
      console.log('   1. Review the migration script output');
      console.log('   2. Check for any errors during migration');
      console.log('   3. Consider re-running the migration');
    }

  } catch (error) {
    console.error('\n💥 Verification failed:', error.message);
    throw error;
  } finally {
    sqlite.close();
    await pgPool.end();
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verify()
    .then(() => {
      console.log('\n✅ Verification completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification failed:', error);
      process.exit(1);
    });
}

module.exports = { verify };
