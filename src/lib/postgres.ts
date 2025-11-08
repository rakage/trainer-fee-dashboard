import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';
import { User, UserRole } from '@/types';

// Check if we're in build phase - don't initialize anything
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-export';

// PostgreSQL connection pool
function getPoolConfig() {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DATABASE || 'postgres',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  };
}

let pool: Pool | null = null;
let cleanupRegistered = false;
let tablesInitialized = false;

async function initializeTables() {
  if (tablesInitialized || isBuildPhase) return;
  
  const pool = getPool();
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'viewer',
        provider TEXT DEFAULT 'credentials',
        last_active_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);

    // Create fee_params table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS fee_params (
        id SERIAL PRIMARY KEY,
        program TEXT NOT NULL,
        category TEXT NOT NULL,
        venue TEXT NOT NULL,
        attendance TEXT NOT NULL,
        percent REAL NOT NULL,
        concat_key TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_concat ON fee_params(concat_key)`);

    // Create trainer_splits table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trainer_splits (
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
      )
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_trainer_splits_prod_id ON trainer_splits(prod_id)`);

    // Create expenses table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        prod_id INTEGER NOT NULL,
        row_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(prod_id, row_id)
      )
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_expenses_prod_id ON expenses(prod_id)`);

    // Create audit_log table (note: singular, not plural)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        prod_id INTEGER NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_prod_id ON audit_log(prod_id)`);
    
    // Also create audit_logs (plural) as an alias/view or table for compatibility
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        userid TEXT NOT NULL,
        action TEXT NOT NULL,
        prodid INTEGER,
        details TEXT NOT NULL,
        createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(userid, action)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(createdat)`);

    // Create grace_price_conversion table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS grace_price_conversion (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_type_key TEXT NOT NULL,
        venue TEXT,
        jpy_price REAL NOT NULL,
        eur_price REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_grace_price_event_type_key ON grace_price_conversion(event_type_key)`);

    // Create param_reporting_grp table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS param_reporting_grp (
        id SERIAL PRIMARY KEY,
        reporting_group TEXT NOT NULL UNIQUE,
        split TEXT NOT NULL,
        trainer_percent REAL NOT NULL,
        alejandro_percent REAL NOT NULL,
        price REAL,
        repeater_price REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_param_reporting_grp_name ON param_reporting_grp(reporting_group)`);

    tablesInitialized = true;
    console.log('PostgreSQL tables initialized successfully');
  } catch (error) {
    console.error('Error initializing PostgreSQL tables:', error);
  }
}

function getPool(): Pool {
  // Don't create pool during build time or if window is defined (browser)
  if (isBuildPhase || typeof window !== 'undefined' || process.env.NODE_ENV === 'test') {
    // Return a stub during build - this won't actually be used
    return {} as Pool;
  }
  
  if (!pool) {
    try {
      pool = new Pool(getPoolConfig());
    } catch (error) {
      console.error('Failed to create PostgreSQL pool:', error);
      return {} as Pool;
    }
    
    pool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
    });
    
    // Initialize tables asynchronously
    initializeTables().catch(err => {
      console.error('Failed to initialize tables:', err);
    });
    
    // Register cleanup handlers only once (not during build)
    if (!cleanupRegistered && !isBuildPhase) {
      cleanupRegistered = true;
      
      const cleanup = () => {
        if (pool) {
          pool.end().catch((err) => {
            console.error('Error closing pool:', err);
          });
          pool = null;
        }
      };
      
      // Handle process termination gracefully
      if (typeof process !== 'undefined') {
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('beforeExit', cleanup);
      }
    }
    
    console.log('Connected to PostgreSQL database');
  }
  
  return pool;
}

export async function closePool(): Promise<void> {
  if (isBuildPhase) return;
  
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('PostgreSQL connection closed');
    } catch (error) {
      console.error('Error closing pool:', error);
    }
  }
}

export class TrainerSplitService {
  static async getByProdId(prodId: number): Promise<any[]> {
    const client = getPool();
    const result = await client.query(
      'SELECT * FROM trainer_splits WHERE prod_id = $1 ORDER BY row_id',
      [prodId]
    );
    return result.rows;
  }

  static async upsert(split: {
    prod_id: number;
    row_id: number;
    name: string;
    percent: number;
    trainer_fee: number;
    cash_received: number;
  }): Promise<void> {
    const client = getPool();
    
    const existing = await client.query(
      'SELECT id FROM trainer_splits WHERE prod_id = $1 AND row_id = $2',
      [split.prod_id, split.row_id]
    );

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE trainer_splits 
         SET name = $1, percent = $2, trainer_fee = $3, cash_received = $4, updated_at = CURRENT_TIMESTAMP 
         WHERE prod_id = $5 AND row_id = $6`,
        [split.name, split.percent, split.trainer_fee, split.cash_received, split.prod_id, split.row_id]
      );
    } else {
      await client.query(
        `INSERT INTO trainer_splits (prod_id, row_id, name, percent, trainer_fee, cash_received) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [split.prod_id, split.row_id, split.name, split.percent, split.trainer_fee, split.cash_received]
      );
    }
  }

  static async delete(prodId: number, rowId: number): Promise<void> {
    const client = getPool();
    await client.query(
      'DELETE FROM trainer_splits WHERE prod_id = $1 AND row_id = $2',
      [prodId, rowId]
    );
  }
}

export class ExpenseService {
  static async getByProdId(prodId: number): Promise<any[]> {
    const client = getPool();
    const result = await client.query(
      'SELECT * FROM expenses WHERE prod_id = $1 ORDER BY row_id',
      [prodId]
    );
    return result.rows;
  }

  static async upsert(expense: {
    prod_id: number;
    row_id: number;
    description: string;
    amount: number;
  }): Promise<void> {
    const client = getPool();
    
    const existing = await client.query(
      'SELECT id FROM expenses WHERE prod_id = $1 AND row_id = $2',
      [expense.prod_id, expense.row_id]
    );

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE expenses 
         SET description = $1, amount = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE prod_id = $3 AND row_id = $4`,
        [expense.description, expense.amount, expense.prod_id, expense.row_id]
      );
    } else {
      await client.query(
        `INSERT INTO expenses (prod_id, row_id, description, amount) 
         VALUES ($1, $2, $3, $4)`,
        [expense.prod_id, expense.row_id, expense.description, expense.amount]
      );
    }
  }

  static async delete(prodId: number, rowId: number): Promise<void> {
    const client = getPool();
    await client.query(
      'DELETE FROM expenses WHERE prod_id = $1 AND row_id = $2',
      [prodId, rowId]
    );
  }
}

export class AuditService {
  static async log(userId: string, action: string, prodId: number, details: string): Promise<void> {
    const client = getPool();
    await client.query(
      `INSERT INTO audit_log (user_id, action, prod_id, details) 
       VALUES ($1, $2, $3, $4)`,
      [userId, action, prodId, details]
    );
  }

  static async getByProdId(prodId: number): Promise<any[]> {
    const client = getPool();
    const result = await client.query(
      'SELECT * FROM audit_log WHERE prod_id = $1 ORDER BY created_at DESC',
      [prodId]
    );
    return result.rows;
  }
}

export class GracePriceService {
  static async getAll(): Promise<{
    id: number;
    eventType: string;
    eventTypeKey: string;
    venue: string | null;
    jpyPrice: number;
    eurPrice: number;
  }[]> {
    const client = getPool();
    const result = await client.query(
      'SELECT * FROM grace_price_conversion ORDER BY event_type, event_type_key'
    );
    
    return result.rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      eventTypeKey: row.event_type_key,
      venue: row.venue || null,
      jpyPrice: row.jpy_price,
      eurPrice: row.eur_price,
    }));
  }

  static async upsert(data: {
    eventType: string;
    eventTypeKey: string;
    venue?: string | null;
    jpyPrice: number;
    eurPrice: number;
  }): Promise<void> {
    const client = getPool();
    await client.query(
      `INSERT INTO grace_price_conversion (event_type, event_type_key, venue, jpy_price, eur_price) 
       VALUES ($1, $2, $3, $4, $5)`,
      [data.eventType, data.eventTypeKey, data.venue || null, data.jpyPrice, data.eurPrice]
    );
  }

  static async update(id: number, data: {
    eventType: string;
    eventTypeKey: string;
    venue?: string | null;
    jpyPrice: number;
    eurPrice: number;
  }): Promise<void> {
    const client = getPool();
    await client.query(
      `UPDATE grace_price_conversion 
       SET event_type = $1, event_type_key = $2, venue = $3, jpy_price = $4, eur_price = $5, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $6`,
      [data.eventType, data.eventTypeKey, data.venue || null, data.jpyPrice, data.eurPrice, id]
    );
  }

  static async delete(id: number): Promise<void> {
    const client = getPool();
    await client.query('DELETE FROM grace_price_conversion WHERE id = $1', [id]);
  }

  static async seedDefaults(): Promise<void> {
    const defaultData = [
      {
        eventType: 'Salsation Training - Repeater',
        eventTypeKey: 'Salsation-Instructor training-Repeater',
        venue: 'Venue',
        jpyPrice: 19400,
        eurPrice: 113.449,
      },
      {
        eventType: 'Salsation Training - Troupe',
        eventTypeKey: 'Salsation-Instructor training-Troupe',
        venue: 'Venue',
        jpyPrice: 19400,
        eurPrice: 113.449,
      },
      {
        eventType: 'Salsation Training - Early Bird',
        eventTypeKey: 'Salsation-Instructor training-Early Bird',
        venue: 'Venue',
        jpyPrice: 29700,
        eurPrice: 173.685,
      },
      {
        eventType: 'Salsation Training - Regular',
        eventTypeKey: 'Salsation-Instructor training-Regular',
        venue: 'Venue',
        jpyPrice: 36100,
        eurPrice: 211.11,
      },
      {
        eventType: 'Salsation Training - Rush',
        eventTypeKey: 'Salsation-Instructor training-Rush',
        venue: 'Venue',
        jpyPrice: 42600,
        eurPrice: 249.12,
      },
      {
        eventType: 'Salsation Training - Free',
        eventTypeKey: 'Salsation-Instructor training-',
        venue: 'Venue',
        jpyPrice: 0,
        eurPrice: 0,
      },
      {
        eventType: 'Choreology Training - Repeater',
        eventTypeKey: 'Choreology-Instructor training-Repeater',
        venue: 'Venue',
        jpyPrice: 19400,
        eurPrice: 113.449,
      },
      {
        eventType: 'Choreology Training - Trouper',
        eventTypeKey: 'Choreology-Instructor training-Troupe',
        venue: 'Venue',
        jpyPrice: 19400,
        eurPrice: 113.449,
      },
      {
        eventType: 'Choreology Training - Early Bird',
        eventTypeKey: 'Choreology-Instructor training-Early Bird',
        venue: 'Venue',
        jpyPrice: 29700,
        eurPrice: 173.685,
      },
      {
        eventType: 'Choreology Training - Regular',
        eventTypeKey: 'Choreology-Instructor training-Regular',
        venue: 'Venue',
        jpyPrice: 36100,
        eurPrice: 211.11,
      },
      {
        eventType: 'Choreology Training - Rush',
        eventTypeKey: 'Choreology-Instructor training-Rush',
        venue: 'Venue',
        jpyPrice: 42600,
        eurPrice: 249.12,
      },
      {
        eventType: 'Choreology Training - Free',
        eventTypeKey: 'Choreology-Instructor training-',
        venue: 'Venue',
        jpyPrice: 0,
        eurPrice: 0,
      },
      {
        eventType: 'KID Instructor Training - Repeater',
        eventTypeKey: 'Kid-Instructor training-Repeater',
        venue: 'Venue',
        jpyPrice: 19400,
        eurPrice: 113.449,
      },
      {
        eventType: 'KID Instructor Training - Trouper',
        eventTypeKey: 'Kid-Instructor training-Troupe',
        venue: 'Venue',
        jpyPrice: 19400,
        eurPrice: 113.449,
      },
      {
        eventType: 'KID Instructor Training - Early Bird',
        eventTypeKey: 'Kid-Instructor training-Early Bird',
        venue: 'Venue',
        jpyPrice: 29700,
        eurPrice: 173.685,
      },
      {
        eventType: 'KID Instructor Training - Regular',
        eventTypeKey: 'Kid-Instructor training-Regular',
        venue: 'Venue',
        jpyPrice: 36100,
        eurPrice: 211.11,
      },
      {
        eventType: 'KID Instructor Training - Rush',
        eventTypeKey: 'Kid-Instructor training-Rush',
        venue: 'Venue',
        jpyPrice: 42600,
        eurPrice: 249.12,
      },
      {
        eventType: 'KID Instructor Training - Free',
        eventTypeKey: 'Kid-Instructor training-',
        venue: 'Venue',
        jpyPrice: 0,
        eurPrice: 0,
      },
    ];

    const client = getPool();
    
    // Use ON CONFLICT DO NOTHING to avoid duplicates
    for (const item of defaultData) {
      try {
        await client.query(
          `INSERT INTO grace_price_conversion (event_type, event_type_key, venue, jpy_price, eur_price) 
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [item.eventType, item.eventTypeKey, item.venue, item.jpyPrice, item.eurPrice]
        );
      } catch (error) {
        console.error('Error seeding grace price:', error);
      }
    }
  }
}

export class ParamReportingGrpService {
  static async getAll(): Promise<{
    id: number;
    reportingGroup: string;
    split: string;
    trainerPercent: number;
    alejandroPercent: number;
    price: number | null;
    repeaterPrice: number | null;
  }[]> {
    const client = getPool();
    const result = await client.query(
      'SELECT * FROM param_reporting_grp ORDER BY reporting_group'
    );
    
    return result.rows.map((row) => ({
      id: row.id,
      reportingGroup: row.reporting_group,
      split: row.split,
      trainerPercent: row.trainer_percent,
      alejandroPercent: row.alejandro_percent,
      price: row.price,
      repeaterPrice: row.repeater_price,
    }));
  }

  static async upsert(data: {
    reportingGroup: string;
    split: string;
    trainerPercent: number;
    alejandroPercent: number;
    price?: number | null;
    repeaterPrice?: number | null;
  }): Promise<void> {
    const client = getPool();
    
    const existing = await client.query(
      'SELECT id FROM param_reporting_grp WHERE reporting_group = $1',
      [data.reportingGroup]
    );

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE param_reporting_grp 
         SET split = $1, trainer_percent = $2, alejandro_percent = $3, price = $4, repeater_price = $5, updated_at = CURRENT_TIMESTAMP 
         WHERE reporting_group = $6`,
        [data.split, data.trainerPercent, data.alejandroPercent, data.price || null, data.repeaterPrice || null, data.reportingGroup]
      );
    } else {
      await client.query(
        `INSERT INTO param_reporting_grp (reporting_group, split, trainer_percent, alejandro_percent, price, repeater_price) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [data.reportingGroup, data.split, data.trainerPercent, data.alejandroPercent, data.price || null, data.repeaterPrice || null]
      );
    }
  }

  static async delete(id: number): Promise<void> {
    const client = getPool();
    await client.query('DELETE FROM param_reporting_grp WHERE id = $1', [id]);
  }

  static async seedDefaults(): Promise<void> {
    const defaultData = [
      {
        reportingGroup: 'Choreology Instructor training',
        split: '30/70',
        trainerPercent: 0.3,
        alejandroPercent: 0.05,
        price: 230,
        repeaterPrice: 120,
      },
      {
        reportingGroup: 'Choreology Workshops Online',
        split: '60/40',
        trainerPercent: 0.7,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Choreology Workshops OnlineGlobal',
        split: '50/50',
        trainerPercent: 0.5,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Choreology Workshops Venue',
        split: '70/30',
        trainerPercent: 0.7,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Kid Instructor training',
        split: '35/65',
        trainerPercent: 0.35,
        alejandroPercent: 0.1,
        price: 230,
        repeaterPrice: 120,
      },
      {
        reportingGroup: 'Kid Instructor training Alejandro',
        split: '35/65',
        trainerPercent: 0.35,
        alejandroPercent: 0.0,
        price: 230,
        repeaterPrice: 120,
      },
      {
        reportingGroup: 'Rootz Instructor training',
        split: '30/70',
        trainerPercent: 0.3,
        alejandroPercent: 0.05,
        price: 230,
        repeaterPrice: 120,
      },
      {
        reportingGroup: 'Rootz Workshops Venue',
        split: '70/30',
        trainerPercent: 0.7,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Instructor training',
        split: '40/60',
        trainerPercent: 0.4,
        alejandroPercent: 0.1,
        price: 230,
        repeaterPrice: 120,
      },
      {
        reportingGroup: 'Salsation Instructor training Alejandro',
        split: '40/60',
        trainerPercent: 0.4,
        alejandroPercent: 0.0,
        price: 230,
        repeaterPrice: 120,
      },
      {
        reportingGroup: 'Salsation Method Training',
        split: '45/55',
        trainerPercent: 0.45,
        alejandroPercent: 0.1,
        price: 230,
        repeaterPrice: 120,
      },
      {
        reportingGroup: 'Salsation Method Training Alejandro',
        split: '45/55',
        trainerPercent: 0.45,
        alejandroPercent: 0.0,
        price: 230,
        repeaterPrice: 120,
      },
      {
        reportingGroup: 'Salsation On Demand',
        split: '50/50',
        trainerPercent: 0.5,
        alejandroPercent: 0.0,
        price: 195,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation On-Demand',
        split: '50/50',
        trainerPercent: 0.5,
        alejandroPercent: 0.0,
        price: 195,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Salsation Blast Alejandro',
        split: '0/100',
        trainerPercent: 0.0,
        alejandroPercent: 0.1,
        price: 60,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Seminar Alejandro',
        split: '70/30',
        trainerPercent: 0.7,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Workshops Online',
        split: '50/50',
        trainerPercent: 0.5,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Workshops OnlineGlobal',
        split: '50/50',
        trainerPercent: 0.5,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Workshops Venue',
        split: '70/30',
        trainerPercent: 0.7,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Seminar Venue',
        split: '70/30',
        trainerPercent: 0.7,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Workshops Alejandro',
        split: '70/30',
        trainerPercent: 0.7,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Trouper Talk',
        split: '0/100',
        trainerPercent: 0.0,
        alejandroPercent: 0.0,
        price: 0,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Seminar OnlineGlobal',
        split: '50/50',
        trainerPercent: 0.5,
        alejandroPercent: 0.0,
        price: null,
        repeaterPrice: null,
      },
      {
        reportingGroup: 'Salsation Join Event Alejandro',
        split: '50/50',
        trainerPercent: 0.5,
        alejandroPercent: 0.0,
        price: 40,
        repeaterPrice: null,
      },
    ];

    const client = getPool();
    
    // Check if table is empty
    const countResult = await client.query('SELECT COUNT(*) as count FROM param_reporting_grp');
    const count = parseInt(countResult.rows[0].count);
    
    if (count === 0) {
      for (const item of defaultData) {
        await this.upsert(item);
      }
    }
  }
}

export class FeeParamService {
  static concatKey(program: string, category: string, venue: string, attendance: string): string {
    return `${program}-${category}-${venue}-${attendance}`;
  }

  static async upsertParam(param: {
    program: string;
    category: string;
    venue: string;
    attendance: string;
    percent: number;
  }): Promise<void> {
    const client = getPool();
    const concat = this.concatKey(param.program, param.category, param.venue, param.attendance);
    
    const existing = await client.query(
      'SELECT id FROM fee_params WHERE concat_key = $1',
      [concat]
    );

    if (existing.rows.length > 0) {
      await client.query(
        `UPDATE fee_params 
         SET program=$1, category=$2, venue=$3, attendance=$4, percent=$5, updated_at=CURRENT_TIMESTAMP 
         WHERE id=$6`,
        [param.program, param.category, param.venue, param.attendance, param.percent, existing.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO fee_params (program, category, venue, attendance, percent, concat_key) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [param.program, param.category, param.venue, param.attendance, param.percent, concat]
      );
    }
  }

  static async list(): Promise<{
    id: number;
    program: string;
    category: string;
    venue: string;
    attendance: string;
    percent: number;
    concat_key: string;
  }[]> {
    const client = getPool();
    const result = await client.query(
      'SELECT * FROM fee_params ORDER BY program, category, venue, attendance'
    );
    return result.rows;
  }

  static async getPercent(
    program: string,
    category: string,
    venue: string,
    attendance: string
  ): Promise<number | null> {
    const concat = this.concatKey(program, category, venue, attendance);
    const client = getPool();
    const result = await client.query(
      'SELECT percent FROM fee_params WHERE concat_key = $1',
      [concat]
    );
    return result.rows.length > 0 ? result.rows[0].percent : null;
  }

  static async delete(id: number): Promise<void> {
    const client = getPool();
    await client.query('DELETE FROM fee_params WHERE id = $1', [id]);
  }

  static async getById(id: number): Promise<{
    id: number;
    program: string;
    category: string;
    venue: string;
    attendance: string;
    percent: number;
    concat_key: string;
  } | null> {
    const client = getPool();
    const result = await client.query('SELECT * FROM fee_params WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  static async seedFromPairs(pairs: { concat: string; percent: number }[]): Promise<void> {
    const client = getPool();
    
    for (const p of pairs) {
      const [program, category, venue, attendance] = p.concat.split('-');
      const concat = this.concatKey(program, category, venue, attendance);
      
      const existing = await client.query(
        'SELECT id FROM fee_params WHERE concat_key = $1',
        [concat]
      );

      if (existing.rows.length > 0) {
        await client.query(
          'UPDATE fee_params SET percent=$1, updated_at=CURRENT_TIMESTAMP WHERE concat_key=$2',
          [p.percent, concat]
        );
      } else {
        await client.query(
          'INSERT INTO fee_params (program, category, venue, attendance, percent, concat_key) VALUES ($1,$2,$3,$4,$5,$6)',
          [program, category, venue, attendance, p.percent, concat]
        );
      }
    }
  }
}

export class UserService {
  static async createUser(userData: {
    email: string;
    name: string;
    password?: string;
    role?: UserRole;
    provider?: string;
  }): Promise<User> {
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const hashedPassword = userData.password ? await bcrypt.hash(userData.password, 12) : null;

    const user = {
      id,
      email: userData.email,
      name: userData.name,
      password: hashedPassword,
      role: userData.role || 'viewer',
      provider: userData.provider || 'credentials',
    };

    const client = getPool();
    await client.query(
      'INSERT INTO users (id, email, name, password, role, provider) VALUES ($1, $2, $3, $4, $5, $6)',
      [user.id, user.email, user.name, user.password, user.role, user.provider]
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static async findByEmail(email: string): Promise<User | null> {
    const client = getPool();
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  static async findById(id: string): Promise<User | null> {
    const client = getPool();
    const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  static async verifyCredentials(email: string, password: string): Promise<User | null> {
    console.log('UserService.verifyCredentials called for email:', email);
    const client = getPool();
    const result = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      console.log('No user found with email:', email);
      return null;
    }
    
    const row = result.rows[0];
    if (!row.password) {
      console.log('User found but no password stored for:', email);
      return null;
    }

    console.log('Comparing password for user:', email);
    const isValid = await bcrypt.compare(password, row.password);
    console.log('Password comparison result:', isValid);

    if (!isValid) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  static async updateUser(
    id: string,
    updates: { name?: string; role?: UserRole }
  ): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) return null;

    const client = getPool();
    await client.query(
      'UPDATE users SET name = $1, role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [updates.name || user.name, updates.role || user.role, id]
    );

    return this.findById(id);
  }

  static async deleteUser(id: string): Promise<boolean> {
    const client = getPool();
    const result = await client.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  static async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    try {
      const client = getPool();
      const result = await client.query(
        'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [hashedPassword, id]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  }

  static async updateLastActive(id: string): Promise<boolean> {
    try {
      const client = getPool();
      const result = await client.query(
        'UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error('Error updating last active:', error);
      return false;
    }
  }

  static async getAllUsers(search?: string): Promise<Omit<User, 'password'>[]> {
    const client = getPool();
    let query = `
      SELECT id, email, name, role, provider, last_active_at, created_at, updated_at 
      FROM users
    `;
    const params: any[] = [];

    if (search) {
      query += ` WHERE name ILIKE $1 OR email ILIKE $2`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await client.query(query, params);
    return result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  static async createDemoUsers(): Promise<void> {
    const demoUsers = [
      {
        email: 'admin@salsation.com',
        name: 'Admin User',
        password: 'admin123',
        role: 'admin' as UserRole,
      },
      {
        email: 'finance@salsation.com',
        name: 'Finance User',
        password: 'finance123',
        role: 'finance' as UserRole,
      },
      {
        email: 'trainer@salsation.com',
        name: 'Trainer User',
        password: 'trainer123',
        role: 'trainer' as UserRole,
      },
      {
        email: 'viewer@salsation.com',
        name: 'Viewer User',
        password: 'viewer123',
        role: 'viewer' as UserRole,
      },
    ];

    for (const userData of demoUsers) {
      const existingUser = await this.findByEmail(userData.email);
      if (!existingUser) {
        await this.createUser(userData);
        console.log(`Created demo user: ${userData.email} (${userData.role})`);
      }
    }
  }
}

// Initialize demo users and seed data on startup for development
// Only run when server actually starts, not during build
async function initializeData() {
  if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
    try {
      await UserService.createDemoUsers();
      
      // Seed fee params
      const initialPairs: { concat: string; percent: number }[] = [
        { concat: 'Choreology-Instructor training-Online-Attended', percent: 0.3 },
        { concat: 'Choreology-Instructor training-Venue-Attended', percent: 0.3 },
        { concat: 'Choreology-Instructor training-Venue-Unattended', percent: 0.2 },
        { concat: 'Choreology-Workshops-OnlineGlobal-Attended', percent: 0.5 },
        { concat: 'Choreology-Workshops-Venue-Attended', percent: 0.7 },
        { concat: 'Choreology-Workshops-Venue-Unattended', percent: 0.5 },
        { concat: 'Kid-Instructor training-Venue-Attended', percent: 0.4 },
        { concat: 'Kid-Instructor training-Venue-Unattended', percent: 0.2 },
        { concat: 'Rootz-Instructor training-Venue-Attended', percent: 0.3 },
        { concat: 'Rootz-Workshops-Venue-Attended', percent: 0.7 },
        { concat: 'Rootz-Workshops-Venue-Unattended', percent: 0.5 },
        { concat: 'Salsation-Instructor training-Online-Attended', percent: 0.4 },
        { concat: 'Salsation-Instructor training-OnlineGlobal-Attended', percent: 0.4 },
        { concat: 'Salsation-Instructor training-OnlineGlobal-Unattended', percent: 0.2 },
        { concat: 'Salsation-Instructor training-Venue-Attended', percent: 0.4 },
        { concat: 'Salsation-Instructor training-Venue-Unattended', percent: 0.2 },
        { concat: 'Salsation-Method Training-Venue-Attended', percent: 0.45 },
        { concat: 'Salsation-Method Training-Venue-Unattended', percent: 0.2 },
        { concat: 'Salsation-On Demand-On Demand-Attended', percent: 0.5 },
        { concat: 'Salsation-On Demand-On Demand-Unattended', percent: 0.5 },
        { concat: 'Salsation-On-Demand-On Demand-Attended', percent: 0.5 },
        { concat: 'Salsation-Seminar-Venue-Attended', percent: 0.7 },
        { concat: 'Salsation-Seminar-Venue-Unattended', percent: 0.5 },
        { concat: 'Salsation-Workshops-Online-Attended', percent: 0.6 },
        { concat: 'Salsation-Workshops-Online-Unattended', percent: 0.5 },
        { concat: 'Salsation-Workshops-OnlineGlobal-Attended', percent: 0.5 },
        { concat: 'Salsation-Workshops-OnlineGlobal-Unattended', percent: 0.5 },
        { concat: 'Salsation-Workshops-Venue-Attended', percent: 0.7 },
        { concat: 'Salsation-Workshops-Venue-Unattended', percent: 0.5 },
        { concat: 'Salsation-Move Forever Training-Attended', percent: 0.45 },
        { concat: 'Salsation-Move Forever Training-Unattended', percent: 0.2 },
        { concat: 'Natasha_Salsation_Instructor training_Venue_Atteneded', percent: 0.45 },
        { concat: 'Natasha_Salsation_Instructor training_Venue_Unatteneded', percent: 0.2 },
        { concat: 'Kid-Instructor training-Online-Attended', percent: 0.4 },
        { concat: 'Kid-Instructor training-Online-Unattended', percent: 0.2 },
        { concat: 'Salsation-Seminar-OnlineGlobal-Attended', percent: 0.5 },
        { concat: 'Salsation-Seminar-OnlineGlobal-Unattended', percent: 0.5 },
        { concat: 'Kid-Instructor training-OnlineGlobal-Attended', percent: 0.4 },
        { concat: 'Kid-Instructor training-OnlineGlobal-Unattended', percent: 0.2 },
        { concat: 'Choreology-Workshops-OnlineGlobal-Unattended', percent: 0.5 },
      ];
      
      await FeeParamService.seedFromPairs(initialPairs);
    } catch (e) {
      console.error('Initialization error:', e);
    }
  }
}

// Export initialization function to be called by server startup
export { initializeData };

export { getPool };
export default getPool;
