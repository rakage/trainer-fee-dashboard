import { Database } from 'better-sqlite3';
import { getDatabase } from './sqlite';
import { AuditLog } from '@/types';

interface LogFilters {
  search?: string;
  action?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

interface LogResult {
  data: AuditLog[];
  total: number;
  page?: number;
  limit?: number;
}

export class ActivityLogger {
  private static db: Database | null = null;

  private static getDB(): Database {
    if (!this.db) {
      this.db = getDatabase();
      this.initializeSchema();
    }
    return this.db;
  }

  private static initializeSchema() {
    const db = this.getDB();
    
    // Create audit_logs table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        action TEXT NOT NULL,
        prodId INTEGER,
        details TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for better performance
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action 
      ON audit_logs(userId, action)
    `);
    
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
      ON audit_logs(createdAt)
    `);
  }

  /**
   * Log an activity
   */
  static async log(
    userId: string,
    action: string,
    prodId: number | null = null,
    details: string = ''
  ): Promise<void> {
    try {
      const db = this.getDB();
      
      const stmt = db.prepare(`
        INSERT INTO audit_logs (userId, action, prodId, details, createdAt)
        VALUES (?, ?, ?, ?, datetime('now'))
      `);
      
      stmt.run(userId, action, prodId, details);
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw error to prevent breaking the main application flow
    }
  }

  /**
   * Get activity logs with filtering and pagination
   */
  static async getLogs(filters: LogFilters = {}): Promise<LogResult> {
    try {
      const db = this.getDB();
      
      let whereClause = '1=1';
      const params: any[] = [];

      // Build WHERE clause based on filters
      if (filters.search) {
        whereClause += ` AND (details LIKE ? OR action LIKE ?)`;
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      if (filters.action) {
        whereClause += ` AND action LIKE ?`;
        params.push(`%${filters.action}%`);
      }

      if (filters.userId) {
        whereClause += ` AND userId = ?`;
        params.push(filters.userId);
      }

      if (filters.dateFrom) {
        whereClause += ` AND date(createdAt) >= ?`;
        params.push(filters.dateFrom);
      }

      if (filters.dateTo) {
        whereClause += ` AND date(createdAt) <= ?`;
        params.push(filters.dateTo);
      }

      // Get total count
      const countStmt = db.prepare(`
        SELECT COUNT(*) as total 
        FROM audit_logs 
        WHERE ${whereClause}
      `);
      const { total } = countStmt.get(...params) as { total: number };

      // Build main query with pagination
      let query = `
        SELECT id, userId, action, prodId, details, createdAt
        FROM audit_logs 
        WHERE ${whereClause}
        ORDER BY createdAt DESC
      `;

      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        query += ` LIMIT ? OFFSET ?`;
        params.push(filters.limit, offset);
      }

      const stmt = db.prepare(query);
      const logs = stmt.all(...params) as AuditLog[];

      return {
        data: logs.map(log => ({
          ...log,
          createdAt: new Date(log.createdAt),
        })),
        total,
        page: filters.page,
        limit: filters.limit,
      };
    } catch (error) {
      console.error('Failed to get activity logs:', error);
      return {
        data: [],
        total: 0,
        page: filters.page,
        limit: filters.limit,
      };
    }
  }

  /**
   * Clean up old logs (optional maintenance method)
   */
  static async cleanupOldLogs(daysToKeep: number = 365): Promise<void> {
    try {
      const db = this.getDB();
      
      const stmt = db.prepare(`
        DELETE FROM audit_logs 
        WHERE createdAt < datetime('now', '-${daysToKeep} days')
      `);
      
      const result = stmt.run();
      console.log(`Cleaned up ${result.changes} old audit log entries`);
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  /**
   * Common logging methods for frequent actions
   */
  static async logLogin(userId: string, details: string = '') {
    await this.log(userId, 'login', null, details);
  }

  static async logLogout(userId: string, details: string = '') {
    await this.log(userId, 'logout', null, details);
  }

  static async logExport(userId: string, prodId: number | null, format: string, details: string = '') {
    await this.log(userId, 'export', prodId, `Exported in ${format} format. ${details}`.trim());
  }

  static async logCreate(userId: string, resource: string, prodId: number | null = null, details: string = '') {
    await this.log(userId, `create_${resource}`, prodId, details);
  }

  static async logUpdate(userId: string, resource: string, prodId: number | null = null, details: string = '') {
    await this.log(userId, `update_${resource}`, prodId, details);
  }

  static async logDelete(userId: string, resource: string, prodId: number | null = null, details: string = '') {
    await this.log(userId, `delete_${resource}`, prodId, details);
  }

  static async logView(userId: string, resource: string, prodId: number | null = null, details: string = '') {
    await this.log(userId, `view_${resource}`, prodId, details);
  }
}
