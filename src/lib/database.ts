import sql, { ConnectionPool, Request } from 'mssql';
import { EventListResponse, EventDetail, EventTicket, TrainerSplit } from '@/types';

interface DatabaseConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    enableArithAbort: boolean;
  };
  pool: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
  };
}

const config: DatabaseConfig = {
  server: process.env.MSSQL_SERVER!,
  database: process.env.MSSQL_DATABASE!,
  user: process.env.MSSQL_USER!,
  password: process.env.MSSQL_PASSWORD!,
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 1,
    idleTimeoutMillis: 30000,
  },
};

let pool: ConnectionPool | null = null;

export async function getConnection(): Promise<ConnectionPool> {
  if (!pool) {
    pool = new sql.ConnectionPool(config);
    await pool.connect();
    console.log('Connected to MSSQL database');
  }
  return pool;
}

export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Database connection closed');
  }
}

// Database query functions
export class DatabaseService {
  
  static async getEventsList(query?: string): Promise<EventListResponse[]> {
    const pool = await getConnection();
    const request = pool.request();
    
    if (query) {
      request.input('q', sql.NVarChar(100), query);
    } else {
      request.input('q', sql.NVarChar(100), null);
    }

    const result = await request.query(`
      SELECT TOP 200 
        e.ProdID, 
        e.ProdName, 
        e.EventDate 
      FROM dbo.Events e 
      WHERE (@q IS NULL OR (
        e.ProdName LIKE '%' + @q + '%' OR 
        CAST(e.ProdID AS NVARCHAR(50)) LIKE '%' + @q + '%'
      )) 
      ORDER BY e.EventDate DESC
    `);

    return result.recordset;
  }

  static async getEventDetail(prodId: number, includeDeleted: boolean = false): Promise<EventDetail | null> {
    const pool = await getConnection();
    const request = pool.request();
    
    request.input('prodId', sql.Int, prodId);
    request.input('deleted', sql.Bit, includeDeleted ? 1 : 0);

    const result = await request.query(`
      SELECT 
        e.ProdID, 
        e.ProdName, 
        e.EventDate, 
        e.Country, 
        e.Venue, 
        ISNULL(e.Trainer_1,'') AS Trainer_1, 
        t.Attendance, 
        t.PaymentMethod, 
        t.TierLevel, 
        t.PriceTotal, 
        t.TrainerFeePct, 
        t.Quantity 
      FROM dbo.Events e 
      INNER JOIN dbo.EventTickets t ON t.ProdID = e.ProdID 
      WHERE e.ProdID = @prodId 
        AND (@deleted IS NULL OR t.DeletedTicket = @deleted)
    `);

    if (result.recordset.length === 0) {
      return null;
    }

    const firstRow = result.recordset[0];
    const event: EventDetail = {
      ProdID: firstRow.ProdID,
      ProdName: firstRow.ProdName,
      EventDate: firstRow.EventDate,
      Country: firstRow.Country,
      Venue: firstRow.Venue,
      Trainer_1: firstRow.Trainer_1,
      tickets: result.recordset.map((row): EventTicket => ({
        Attendance: row.Attendance,
        PaymentMethod: row.PaymentMethod,
        TierLevel: row.TierLevel,
        PriceTotal: row.PriceTotal,
        TrainerFeePct: row.TrainerFeePct,
        Quantity: row.Quantity,
      })),
    };

    return event;
  }

  static async getTrainerSplits(prodId: number): Promise<TrainerSplit[]> {
    const pool = await getConnection();
    const request = pool.request();
    
    request.input('prodId', sql.Int, prodId);

    const result = await request.query(`
      SELECT 
        ProdID,
        RowId,
        Name,
        Percent,
        CashReceived
      FROM dbo.EventTrainerSplits 
      WHERE ProdID = @prodId
      ORDER BY RowId
    `);

    return result.recordset.map((row, index): TrainerSplit => ({
      id: index + 1,
      ProdID: row.ProdID,
      RowId: row.RowId,
      Name: row.Name,
      Percent: row.Percent,
      TrainerFee: 0, // Will be calculated in frontend
      CashReceived: row.CashReceived,
      Payable: 0, // Will be calculated in frontend
    }));
  }

  static async saveTrainerSplit(split: TrainerSplit): Promise<void> {
    const pool = await getConnection();
    const request = pool.request();
    
    request.input('prodId', sql.Int, split.ProdID);
    request.input('rowId', sql.Int, split.RowId);
    request.input('name', sql.NVarChar(200), split.Name);
    request.input('percent', sql.Decimal(5, 2), split.Percent);
    request.input('cashReceived', sql.Money, split.CashReceived);

    await request.query(`
      MERGE dbo.EventTrainerSplits AS target
      USING (VALUES (@prodId, @rowId, @name, @percent, @cashReceived)) AS src(ProdID, RowId, Name, Percent, CashReceived)
      ON target.ProdID = src.ProdID AND target.RowId = src.RowId
      WHEN MATCHED THEN 
        UPDATE SET 
          Name = src.Name, 
          Percent = src.Percent, 
          CashReceived = src.CashReceived, 
          UpdatedAt = SYSDATETIME()
      WHEN NOT MATCHED THEN 
        INSERT (ProdID, RowId, Name, Percent, CashReceived, CreatedAt) 
        VALUES (src.ProdID, src.RowId, src.Name, src.Percent, src.CashReceived, SYSDATETIME())
    `);
  }

  static async deleteTrainerSplit(prodId: number, rowId: number): Promise<void> {
    const pool = await getConnection();
    const request = pool.request();
    
    request.input('prodId', sql.Int, prodId);
    request.input('rowId', sql.Int, rowId);

    await request.query(`
      DELETE FROM dbo.EventTrainerSplits 
      WHERE ProdID = @prodId AND RowId = @rowId
    `);
  }

  static async logAuditEvent(userId: string, action: string, prodId: number, details: string): Promise<void> {
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      request.input('userId', sql.NVarChar(50), userId);
      request.input('action', sql.NVarChar(100), action);
      request.input('prodId', sql.Int, prodId);
      request.input('details', sql.NVarChar(sql.MAX), details);

      await request.query(`
        INSERT INTO dbo.AuditLog (UserId, Action, ProdId, Details, CreatedAt)
        VALUES (@userId, @action, @prodId, @details, SYSDATETIME())
      `);
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error for audit logging failures
    }
  }
}

// Utility function for parameterized queries
export function createRequest(pool: ConnectionPool): Request {
  return pool.request();
}

// Handle cleanup on process termination
process.on('SIGINT', async () => {
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnection();
  process.exit(0);
});
