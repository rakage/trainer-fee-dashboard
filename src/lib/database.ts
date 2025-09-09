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
      WITH base AS (
        SELECT DISTINCT
          p.id as ProdID, 
          p.name as ProdName,  
          c.name as Category, 
          sao2.name as Program,
          NULL as ReportingGroup,
          CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE) as EventDate, 
          p.price as ProductPrice, 
          v.Name as Vendor,
          sao.Name as Country,
          p.StockQuantity,
          p.DisableBuyButton as Cancelled
        FROM product p
        LEFT JOIN Product_Category_Mapping pcm ON p.id = pcm.ProductId
        LEFT JOIN Product_ProductAttribute_Mapping pam ON p.id = pam.ProductId
        LEFT JOIN SalsationEvent_Country_Mapping scm ON p.id = scm.ProductId
        LEFT JOIN country cn ON scm.CountryId = cn.Id
        LEFT JOIN ProductAttributeValue pav ON pam.id = pav.ProductAttributeMappingId
        LEFT JOIN Category c ON pcm.CategoryId = c.id
        LEFT JOIN Vendor v ON p.VendorId = v.Id
        LEFT JOIN Product_SpecificationAttribute_Mapping psm ON p.Id = psm.productid
        LEFT JOIN SpecificationAttributeOption sao ON psm.SpecificationAttributeOptionId = sao.Id 
        LEFT JOIN SpecificationAttribute sa ON sao.SpecificationAttributeId = sa.Id
        LEFT JOIN Product_SpecificationAttribute_Mapping psm2 ON p.Id = psm2.productid
        LEFT JOIN SpecificationAttributeOption sao2 ON psm2.SpecificationAttributeOptionId = sao2.Id 
        LEFT JOIN SpecificationAttribute sa2 ON sao2.SpecificationAttributeId = sa2.Id
        WHERE sa.id = 10
          AND sa2.id = 6
          AND (p.Published = 1 OR (p.id = '40963' AND p.Published = 0))
          AND (pav.name LIKE '%2024%' OR pav.name LIKE '%2025%')
          AND p.id NOT IN ('53000', '55053')
          AND (@q IS NULL OR (
            p.name LIKE '%' + @q + '%' OR 
            CAST(p.id AS NVARCHAR(50)) LIKE '%' + @q + '%' OR
            sao.Name LIKE '%' + @q + '%'
          ))
      ),
      finals AS (
        SELECT 
          *,
          ROW_NUMBER() OVER(PARTITION BY ProdID ORDER BY EventDate ASC) as rn
        FROM base
      )
      SELECT TOP 200
        ProdID,
        ProdName,
        EventDate
      FROM finals
      WHERE rn = 1
      ORDER BY EventDate DESC
    `);

    return result.recordset;
  }

  static async getEventDetail(prodId: number, includeDeleted: boolean = false): Promise<EventDetail | null> {
    const pool = await getConnection();
    const request = pool.request();
    
    request.input('prodId', sql.Int, prodId);

    // Get event details using the same structure as getEventsList
    const eventResult = await request.query(`
      WITH base AS (
        SELECT DISTINCT
          p.id as ProdID, 
          p.name as ProdName,  
          c.name as Category, 
          sao2.name as Program,
          NULL as ReportingGroup,
          CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE) as EventDate, 
          p.price as ProductPrice, 
          v.Name as Vendor,
          sao.Name as Country,
          ISNULL(v.Name, 'Unknown Venue') as Venue,
          ISNULL(v.Name, 'Unknown Trainer') as Trainer_1,
          p.StockQuantity,
          p.DisableBuyButton as Cancelled
        FROM product p
        LEFT JOIN Product_Category_Mapping pcm ON p.id = pcm.ProductId
        LEFT JOIN Product_ProductAttribute_Mapping pam ON p.id = pam.ProductId
        LEFT JOIN SalsationEvent_Country_Mapping scm ON p.id = scm.ProductId
        LEFT JOIN country cn ON scm.CountryId = cn.Id
        LEFT JOIN ProductAttributeValue pav ON pam.id = pav.ProductAttributeMappingId
        LEFT JOIN Category c ON pcm.CategoryId = c.id
        LEFT JOIN Vendor v ON p.VendorId = v.Id
        LEFT JOIN Product_SpecificationAttribute_Mapping psm ON p.Id = psm.productid
        LEFT JOIN SpecificationAttributeOption sao ON psm.SpecificationAttributeOptionId = sao.Id 
        LEFT JOIN SpecificationAttribute sa ON sao.SpecificationAttributeId = sa.Id
        LEFT JOIN Product_SpecificationAttribute_Mapping psm2 ON p.Id = psm2.productid
        LEFT JOIN SpecificationAttributeOption sao2 ON psm2.SpecificationAttributeOptionId = sao2.Id 
        LEFT JOIN SpecificationAttribute sa2 ON sao2.SpecificationAttributeId = sa2.Id
        WHERE sa.id = 10
          AND sa2.id = 6
          AND p.id = @prodId
      ),
      finals AS (
        SELECT 
          *,
          ROW_NUMBER() OVER(PARTITION BY ProdID ORDER BY EventDate ASC) as rn
        FROM base
      )
      SELECT *
      FROM finals
      WHERE rn = 1
    `);

    if (eventResult.recordset.length === 0) {
      return null;
    }

    const eventRow = eventResult.recordset[0];

    // TODO: Replace this with your actual order/ticket query
    // For now, create sample ticket data based on the event
    const tickets: EventTicket[] = [
      {
        Attendance: 'Attended',
        PaymentMethod: 'PayPal',
        TierLevel: 'Early Bird',
        PriceTotal: eventRow.ProductPrice * 0.8, // 80% of product price
        TrainerFeePct: 0.7, // 70% trainer fee
        Quantity: Math.floor(eventRow.StockQuantity * 0.6) || 10, // 60% of stock or default 10
      },
      {
        Attendance: 'Attended',
        PaymentMethod: 'PayPal', 
        TierLevel: 'Regular',
        PriceTotal: eventRow.ProductPrice,
        TrainerFeePct: 0.7,
        Quantity: Math.floor(eventRow.StockQuantity * 0.3) || 5,
      },
      {
        Attendance: 'Attended',
        PaymentMethod: 'Cash',
        TierLevel: 'Walk-in',
        PriceTotal: eventRow.ProductPrice * 1.1, // 110% of product price
        TrainerFeePct: 0.7,
        Quantity: Math.floor(eventRow.StockQuantity * 0.1) || 2,
      }
    ];

    const event: EventDetail = {
      ProdID: eventRow.ProdID,
      ProdName: eventRow.ProdName,
      EventDate: eventRow.EventDate,
      Country: eventRow.Country,
      Venue: eventRow.Venue,
      Trainer_1: eventRow.Trainer_1,
      tickets,
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
