import { Pool } from 'pg';
import { getPool } from './postgres';
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
  private static getPool(): Pool {
    return getPool();
  }

  private static async initializeSchema() {
    const pool = this.getPool();
    
    try {
      // Create audit_logs table if it doesn't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          userId TEXT NOT NULL,
          action TEXT NOT NULL,
          prodId INTEGER,
          details TEXT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index for better performance
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action 
        ON audit_logs(userId, action)
      `);
      
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
        ON audit_logs(createdAt)
      `);
    } catch (error) {
      console.error('Failed to initialize schema:', error);
    }
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
      const pool = this.getPool();
      
      await pool.query(
        `INSERT INTO audit_logs (userId, action, prodId, details, createdAt)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, action, prodId, details]
      );
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
      const pool = this.getPool();
      
      let whereClause = '1=1';
      const params: any[] = [];
      let paramIndex = 1;

      // Build WHERE clause based on filters
      if (filters.search) {
        whereClause += ` AND (al.details ILIKE $${paramIndex} OR al.action ILIKE $${paramIndex + 1} OR u.name ILIKE $${paramIndex + 2} OR u.email ILIKE $${paramIndex + 3})`;
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        paramIndex += 4;
      }

      if (filters.action) {
        whereClause += ` AND al.action ILIKE $${paramIndex}`;
        params.push(`%${filters.action}%`);
        paramIndex++;
      }

      if (filters.userId) {
        whereClause += ` AND al.userId = $${paramIndex}`;
        params.push(filters.userId);
        paramIndex++;
      }

      if (filters.dateFrom) {
        whereClause += ` AND DATE(al.createdAt) >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }

      if (filters.dateTo) {
        whereClause += ` AND DATE(al.createdAt) <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) as total 
         FROM audit_logs al
         LEFT JOIN users u ON al.userId = u.id
         WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.rows[0].total);

      // Build main query with pagination - join with users table to get user names
      let query = `
        SELECT 
          al.id, 
          al.userId, 
          u.name as userName,
          u.email as userEmail,
          al.action, 
          al.prodId, 
          al.details, 
          al.createdAt
        FROM audit_logs al
        LEFT JOIN users u ON al.userId = u.id
        WHERE ${whereClause}
        ORDER BY al.createdAt DESC
      `;

      // Create a copy of params for the main query
      const queryParams = [...params];
      
      if (filters.page && filters.limit) {
        const offset = (filters.page - 1) * filters.limit;
        query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        queryParams.push(filters.limit, offset);
      }

      const result = await pool.query(query, queryParams);
      const logs = result.rows as AuditLog[];

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
      const pool = this.getPool();
      
      const result = await pool.query(
        `DELETE FROM audit_logs 
         WHERE createdAt < CURRENT_TIMESTAMP - INTERVAL '1 day' * $1`,
        [daysToKeep]
      );
      
      console.log(`Cleaned up ${result.rowCount || 0} old audit log entries`);
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
