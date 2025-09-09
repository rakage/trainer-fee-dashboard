import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { User, UserRole } from '@/types';

// Initialize SQLite database
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join(process.cwd(), 'users.db')
  : path.join(process.cwd(), 'dev-users.db');

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create users table
const createUsersTable = db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'viewer',
    provider TEXT DEFAULT 'credentials',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

createUsersTable.run();

// Fee parameters table
const createFeeParamsTable = db.prepare(`
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
`);

createFeeParamsTable.run();

// Create indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)').run();
db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_concat ON fee_params(concat_key)').run();

// Prepared statements
const insertUser = db.prepare(`
  INSERT INTO users (id, email, name, password, role, provider)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const findUserByEmail = db.prepare(`
  SELECT * FROM users WHERE email = ?
`);

const findUserById = db.prepare(`
  SELECT * FROM users WHERE id = ?
`);

const updateUser = db.prepare(`
  UPDATE users SET name = ?, role = ?, updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

const getAllUsers = db.prepare(`
  SELECT id, email, name, role, provider, created_at, updated_at 
  FROM users 
  ORDER BY created_at DESC
`);

export class FeeParamService {
  static concatKey(program: string, category: string, venue: string, attendance: string): string {
    return `${program}-${category}-${venue}-${attendance}`;
  }

  static upsertParam(param: { program: string; category: string; venue: string; attendance: string; percent: number; }): void {
    const concat = this.concatKey(param.program, param.category, param.venue, param.attendance);
    const existing = db.prepare('SELECT id FROM fee_params WHERE concat_key = ?').get(concat) as any;
    if (existing?.id) {
      db.prepare(`UPDATE fee_params SET program=?, category=?, venue=?, attendance=?, percent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(param.program, param.category, param.venue, param.attendance, param.percent, existing.id);
    } else {
      db.prepare(`INSERT INTO fee_params (program, category, venue, attendance, percent, concat_key) VALUES (?,?,?,?,?,?)`)
        .run(param.program, param.category, param.venue, param.attendance, param.percent, concat);
    }
  }

  static list(): { id: number; program: string; category: string; venue: string; attendance: string; percent: number; concat_key: string; }[] {
    return db.prepare('SELECT * FROM fee_params ORDER BY program, category, venue, attendance').all() as any[];
  }

  static getPercent(program: string, category: string, venue: string, attendance: string): number | null {
    const concat = this.concatKey(program, category, venue, attendance);
    const row = db.prepare('SELECT percent FROM fee_params WHERE concat_key = ?').get(concat) as any;
    return row?.percent ?? null;
  }

  static delete(id: number): void {
    db.prepare('DELETE FROM fee_params WHERE id = ?').run(id);
  }

  static getById(id: number): { id: number; program: string; category: string; venue: string; attendance: string; percent: number; concat_key: string; } | null {
    return db.prepare('SELECT * FROM fee_params WHERE id = ?').get(id) as any;
  }

  static seedFromPairs(pairs: { concat: string; percent: number; }[]) {
    const insert = db.prepare(`INSERT OR IGNORE INTO fee_params (program, category, venue, attendance, percent, concat_key) VALUES (?,?,?,?,?,?)`);
    const update = db.prepare(`UPDATE fee_params SET percent=?, updated_at=CURRENT_TIMESTAMP WHERE concat_key=?`);
    const trx = db.transaction(() => {
      for (const p of pairs) {
        const [program, category, venue, attendance] = p.concat.split('-');
        const concat = this.concatKey(program, category, venue, attendance);
        const existing = db.prepare('SELECT id FROM fee_params WHERE concat_key = ?').get(concat) as any;
        if (existing?.id) {
          update.run(p.percent, concat);
        } else {
          insert.run(program, category, venue, attendance, p.percent, concat);
        }
      }
    });
    trx();
  }
}

export class UserService {
  // Create a new user
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
      provider: userData.provider || 'credentials'
    };

    insertUser.run(
      user.id,
      user.email,
      user.name,
      user.password,
      user.role,
      user.provider
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Find user by email
  static findByEmail(email: string): User | null {
    const row = findUserByEmail.get(email) as any;
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  // Find user by ID
  static findById(id: string): User | null {
    const row = findUserById.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  // Verify user credentials
  static async verifyCredentials(email: string, password: string): Promise<User | null> {
    const row = findUserByEmail.get(email) as any;
    if (!row || !row.password) return null;

    const isValid = await bcrypt.compare(password, row.password);
    if (!isValid) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  // Update user
  static updateUser(id: string, updates: { name?: string; role?: UserRole }): boolean {
    const user = this.findById(id);
    if (!user) return false;

    updateUser.run(
      updates.name || user.name,
      updates.role || user.role,
      id
    );

    return true;
  }

  // Get all users (admin only)
  static getAllUsers(): Omit<User, 'password'>[] {
    const rows = getAllUsers.all() as any[];
    return rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role as UserRole,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  // Create default demo users
  static async createDemoUsers(): Promise<void> {
    const demoUsers = [
      { email: 'admin@salsation.com', name: 'Admin User', password: 'admin123', role: 'admin' as UserRole },
      { email: 'finance@salsation.com', name: 'Finance User', password: 'finance123', role: 'finance' as UserRole },
      { email: 'trainer@salsation.com', name: 'Trainer User', password: 'trainer123', role: 'trainer' as UserRole },
      { email: 'viewer@salsation.com', name: 'Viewer User', password: 'viewer123', role: 'viewer' as UserRole }
    ];

    for (const userData of demoUsers) {
      const existingUser = this.findByEmail(userData.email);
      if (!existingUser) {
        await this.createUser(userData);
        console.log(`Created demo user: ${userData.email} (${userData.role})`);
      }
    }
  }
}

// Initialize demo users on startup
if (process.env.NODE_ENV === 'development') {
  UserService.createDemoUsers().catch(console.error);

  // Seed fee params once (idempotent)
  const initialPairs: { concat: string; percent: number }[] = [
    { concat: 'Choreology-Instructor training-Online-Attended', percent: 0.30 },
    { concat: 'Choreology-Instructor training-Venue-Attended', percent: 0.30 },
    { concat: 'Choreology-Instructor training-Venue-Unattended', percent: 0.20 },
    { concat: 'Choreology-Workshops-OnlineGlobal-Attended', percent: 0.50 },
    { concat: 'Choreology-Workshops-Venue-Attended', percent: 0.70 },
    { concat: 'Choreology-Workshops-Venue-Unattended', percent: 0.50 },
    { concat: 'Kid-Instructor training-Venue-Attended', percent: 0.40 },
    { concat: 'Kid-Instructor training-Venue-Unattended', percent: 0.20 },
    { concat: 'Rootz-Instructor training-Venue-Attended', percent: 0.30 },
    { concat: 'Rootz-Workshops-Venue-Attended', percent: 0.70 },
    { concat: 'Rootz-Workshops-Venue-Unattended', percent: 0.50 },
    { concat: 'Salsation-Instructor training-Online-Attended', percent: 0.40 },
    { concat: 'Salsation-Instructor training-OnlineGlobal-Attended', percent: 0.40 },
    { concat: 'Salsation-Instructor training-OnlineGlobal-Unattended', percent: 0.20 },
    { concat: 'Salsation-Instructor training-Venue-Attended', percent: 0.40 },
    { concat: 'Salsation-Instructor training-Venue-Unattended', percent: 0.20 },
    { concat: 'Salsation-Method Training-Venue-Attended', percent: 0.45 },
    { concat: 'Salsation-Method Training-Venue-Unattended', percent: 0.20 },
    { concat: 'Salsation-On Demand-On Demand-Attended', percent: 0.50 },
    { concat: 'Salsation-On Demand-On Demand-Unattended', percent: 0.50 },
    { concat: 'Salsation-On-Demand-On Demand-Attended', percent: 0.50 },
    { concat: 'Salsation-Seminar-Venue-Attended', percent: 0.70 },
    { concat: 'Salsation-Seminar-Venue-Unattended', percent: 0.50 },
    { concat: 'Salsation-Workshops-Online-Attended', percent: 0.60 },
    { concat: 'Salsation-Workshops-Online-Unattended', percent: 0.50 },
    { concat: 'Salsation-Workshops-OnlineGlobal-Attended', percent: 0.50 },
    { concat: 'Salsation-Workshops-OnlineGlobal-Unattended', percent: 0.50 },
    { concat: 'Salsation-Workshops-Venue-Attended', percent: 0.70 },
    { concat: 'Salsation-Workshops-Venue-Unattended', percent: 0.50 },
    { concat: 'Salsation-Move Forever Training-Attended', percent: 0.45 },
    { concat: 'Salsation-Move Forever Training-Unattended', percent: 0.20 },
    { concat: 'Natasha_Salsation_Instructor training_Venue_Atteneded', percent: 0.45 },
    { concat: 'Natasha_Salsation_Instructor training_Venue_Unatteneded', percent: 0.20 },
    { concat: 'Kid-Instructor training-Online-Attended', percent: 0.40 },
    { concat: 'Kid-Instructor training-Online-Unattended', percent: 0.20 },
    { concat: 'Salsation-Seminar-OnlineGlobal-Attended', percent: 0.50 },
    { concat: 'Salsation-Seminar-OnlineGlobal-Unattended', percent: 0.50 },
    { concat: 'Kid-Instructor training-OnlineGlobal-Attended', percent: 0.40 },
    { concat: 'Kid-Instructor training-OnlineGlobal-Unattended', percent: 0.20 },
    { concat: 'Choreology-Workshops-OnlineGlobal-Unattended', percent: 0.50 },
  ];
  try {
    FeeParamService.seedFromPairs(initialPairs);
  } catch (e) {
    console.error('Seeding fee params failed (non-fatal):', e);
  }
}

export default db;
