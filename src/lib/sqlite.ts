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

// Create indexes
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)').run();
db.prepare('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)').run();

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
}

export default db;
