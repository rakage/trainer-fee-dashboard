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
    trustServerCertificate: false, // Set to false for AWS RDS
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
            AND EventDate >= DATEADD(MONTH, -2, GETDATE())
            AND EventDate <= DATEFROMPARTS(YEAR(GETDATE()), 12, 31)
      ORDER BY EventDate DESC
    `);

    return result.recordset;
  }

  static async getEventDetail(prodId: number, includeDeleted: boolean = false): Promise<EventDetail | null> {
    const pool = await getConnection();
    const request = pool.request();
    
    request.input('prodId', sql.Int, prodId);

    // Use the full order query to get actual order data with trainer fee calculation
    const orderResult = await request.query(`
      with base as (
        select distinct
        o.id as OrderID, 
        o.PaidDateUtc as DatePaid, 
        CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE) as EventDate, 
        p.id as ProdID, 
        p.name as ProdName,  
        c.name as Category, 
        sao2.name as Program,
        oi.quantity, 
        p.price as ProductPrice, 
        oi.UnitPriceInclTax as UnitPrice, 
        oi.PriceInclTax as PriceTotal,
        tp.Designation as TierLevel,
        v.Name as Vendor,
        sao.Name as Country,
        cu.id as CustomerID,
        cu.username as Customer,
        CASE  WHEN (o.CaptureTransactionId IS NOT NULL and oi.UnitPriceInclTax = 0)
               THEN 'Free Ticket'
               WHEN o.CaptureTransactionId IS NOT NULL 
               THEN 'Paypal'
               WHEN (o.CaptureTransactionId IS NULL and oi.UnitPriceInclTax = 0)
               THEN 'Free Ticket'
               ELSE 'Cash'
        END AS PaymentMethod,
        CASE WHEN ss.attendedsetdateUTC IS NOT NULL
            THEN 'Attended'
            ELSE 'Unattended'
        END AS Attendance,
        o.paymentstatusid as PaymentStatus,
        p.StockQuantity
        from product p
        left join OrderItem oi on p.id = oi.ProductId
        left join [Order] o on oi.OrderId = o.id
        left join Product_Category_Mapping pcm on p.id = pcm.ProductId
        left join Product_ProductAttribute_Mapping pam on p.id = pam.ProductId
        left join SalsationEvent_Country_Mapping scm on p.id = scm.ProductId
        left join country cn on scm.CountryId = cn.Id
        left join ProductAttributeValue pav on pam.id = pav.ProductAttributeMappingId
        left join Category c on pcm.CategoryId = c.id
        left join Vendor v on p.VendorId = v.Id
        left join Customer cu on o.CustomerId = cu.id
        left join customer_customerrole_mapping crm on cu.id = crm.customer_id
        left join customerrole cr on crm.customerrole_id = cr.id
        left join Product_SpecificationAttribute_Mapping psm on p.Id = psm.productid
        left join SpecificationAttributeOption sao on psm.SpecificationAttributeOptionId = sao.Id 
        left join SpecificationAttribute sa on sao.SpecificationAttributeId = sa.Id
        left join Product_SpecificationAttribute_Mapping psm2 on p.Id = psm2.productid
        left join SpecificationAttributeOption sao2 on psm2.SpecificationAttributeOptionId = sao2.Id 
        left join SpecificationAttribute sa2 on sao2.SpecificationAttributeId = sa2.Id
        left join SalsationSubscriber ss on (oi.Id = ss.OrderItemId and cu.id = ss.CustomerId and p.id = ss.parentid and o.id = ss.orderid)
        left join TierPrice tp on (p.id = tp.productId and oi.PriceInclTax = tp.price and oi.Quantity = tp.Quantity)
        where sa.id = 10
        and sa2.id = 6
        and o.orderstatusid = '30'
        and o.paymentstatusid in ('30','35')
        and p.DisableBuyButton = 0
        and (p.Published = 1 or (p.id = '40963' and p.Published = 0))
        and (pav.name like '%2024%' or pav.name like '%2025%')
        and p.id not in ('54958', '53000', '55053')
        and p.id = @prodId
        UNION
        select distinct
        o.id as OrderID, 
        o.PaidDateUtc as DatePaid, 
        CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE) as EventDate, 
        p.id as ProdID, 
        p.name as ProdName,  
        c.name as Category, 
        sao2.name as Program,
        oi.quantity, 
        p.price as ProductPrice, 
        oi.UnitPriceInclTax as UnitPrice, 
        oi.PriceInclTax as PriceTotal,
        tp.Designation as TierLevel,
        v.Name as Vendor,
        sao.Name as Country,
        cu.id as CustomerID,
        cu.username as Customer,
        CASE  WHEN (o.CaptureTransactionId IS NOT NULL and oi.UnitPriceInclTax = 0)
               THEN 'Free Ticket'
               WHEN o.CaptureTransactionId IS NOT NULL 
               THEN 'Paypal'
               WHEN (o.CaptureTransactionId IS NULL and oi.UnitPriceInclTax = 0)
               THEN 'Free Ticket'
               ELSE 'Cash'
        END AS PaymentMethod,
        CASE WHEN ss.attendedsetdateUTC IS NOT NULL
            THEN 'Attended'
            ELSE 'Unattended'
        END AS Attendance,
        o.paymentstatusid as PaymentStatus,
        p.StockQuantity
        from product p
        left join OrderItem oi on p.id = oi.ProductId
        left join [Order] o on oi.OrderId = o.id
        left join Product_Category_Mapping pcm on p.id = pcm.ProductId
        left join Product_ProductAttribute_Mapping pam on p.id = pam.ProductId
        left join SalsationEvent_Country_Mapping scm on p.id = scm.ProductId
        left join country cn on scm.CountryId = cn.Id
        left join ProductAttributeValue pav on pam.id = pav.ProductAttributeMappingId
        left join Category c on pcm.CategoryId = c.id
        left join Vendor v on p.VendorId = v.Id
        left join Customer cu on o.CustomerId = cu.id
        left join customer_customerrole_mapping crm on cu.id = crm.customer_id
        left join customerrole cr on crm.customerrole_id = cr.id
        left join Product_SpecificationAttribute_Mapping psm on p.Id = psm.productid
        left join SpecificationAttributeOption sao on psm.SpecificationAttributeOptionId = sao.Id 
        left join SpecificationAttribute sa on sao.SpecificationAttributeId = sa.Id
        left join Product_SpecificationAttribute_Mapping psm2 on p.Id = psm2.productid
        left join SpecificationAttributeOption sao2 on psm2.SpecificationAttributeOptionId = sao2.Id 
        left join SpecificationAttribute sa2 on sao2.SpecificationAttributeId = sa2.Id
        left join SalsationSubscriber ss on (oi.Id = ss.OrderItemId and cu.id = ss.CustomerId and p.id = ss.parentid and o.id = ss.orderid)
        left join TierPrice tp on (p.id = tp.productId and oi.PriceInclTax = tp.price and oi.Quantity = tp.Quantity)
        where sa.id = 10
        and sa2.id = 6
        and o.orderstatusid = '30'
        and o.paymentstatusid in ('30','35')
        and p.DisableBuyButton = 0
        and p.id = @prodId
        and p.id not in ('53000', '55053')
        and (o.PaidDateUtc like '%2024%' or o.PaidDateUtc like '%2025%')
      )
      , finals as (
        select
          *
          , row_number() over(partition by orderid, prodid, customerid order by eventdate asc) rn
        from base
      )
      , final_1 as (
        select 
            OrderID, DatePaid, EventDate, ProdID, ProdName, Category, Program,
            quantity, ProductPrice, UnitPrice, PriceTotal, TierLevel, Vendor, Country,
            CustomerID, Customer, PaymentMethod, Attendance, PaymentStatus, StockQuantity,
            CASE 
                WHEN ProdName LIKE '%Online%' and ProdName LIKE '%Global%' THEN 'OnlineGlobal'
                WHEN ProdName LIKE '%Online%' or ProdName LIKE '%En Linea%' or ProdName LIKE '%En Línea%' THEN 'Online'
                WHEN ProdName LIKE '%Venue,%' THEN 'Venue'
                WHEN ProdName LIKE '%Presencial%' THEN 'Venue'
                WHEN ProdName LIKE 'ON DEMAND!%' THEN 'On Demand'
                WHEN ProdName LIKE 'ISOLATION INSPIRATION Workshop%' or ProdName LIKE 'SALSATION Workshop with%' THEN 'Venue'
                WHEN @prodId = 68513 THEN 'Venue'
                WHEN ProdName like '%THE SALSATION BLAST%' or ProdName like '%SALSATION Method Training%' THEN 'Venue'
                ELSE NULL
            END AS Location
        from finals
        where rn = 1
      )
      select *, concat(Program, '-', Category, '-', Location, '-', Attendance) as ConcatTrainerPercentKey
      from final_1
    `);

    if (orderResult.recordset.length === 0) {
      // If no orders found, still try to get basic event info
      const eventResult = await request.query(`
        SELECT DISTINCT
          p.id as ProdID, 
          p.name as ProdName,  
          c.name as Category, 
          sao2.name as Program,
          CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE) as EventDate, 
          v.Name as Vendor,
          sao.Name as Country
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
        WHERE sa.id = 10 AND sa2.id = 6 AND p.id = @prodId
      `);
      
      if (eventResult.recordset.length === 0) {
        return null;
      }
      
      const eventRow = eventResult.recordset[0];
      return {
        ProdID: eventRow.ProdID,
        ProdName: eventRow.ProdName,
        EventDate: eventRow.EventDate,
        Country: eventRow.Country,
        Venue: eventRow.Vendor,
        Trainer_1: eventRow.Vendor,
        tickets: [],
      };
    }

    // Group orders by key characteristics and calculate trainer fees using SQLite
    const tickets: EventTicket[] = [];
    const eventRow = orderResult.recordset[0];
    
    // Group by Attendance, PaymentMethod, TierLevel
    const groupedOrders = orderResult.recordset.reduce((acc, order) => {
      const key = `${order.Attendance}-${order.PaymentMethod}-${order.TierLevel || 'Standard'}`;
      if (!acc[key]) {
        acc[key] = {
          Attendance: order.Attendance,
          PaymentMethod: order.PaymentMethod,
          TierLevel: order.TierLevel || 'Standard',
          PriceTotal: 0,
          Quantity: 0,
          ConcatTrainerPercentKey: order.ConcatTrainerPercentKey,
        };
      }
      acc[key].PriceTotal += order.PriceTotal || 0;
      acc[key].Quantity += order.quantity || 0;
      return acc;
    }, {} as any);

    // Convert grouped data to tickets and calculate trainer fee percentages
    for (const group of Object.values(groupedOrders) as any[]) {
      // Get the trainer fee percentage from SQLite using the concat key
      const feePercent = this.getTrainerFeePercent(group.ConcatTrainerPercentKey);
      
      tickets.push({
        Attendance: group.Attendance,
        PaymentMethod: group.PaymentMethod,
        TierLevel: group.TierLevel,
        PriceTotal: group.PriceTotal,
        TrainerFeePct: feePercent,
        Quantity: group.Quantity,
      });
    }

    const event: EventDetail = {
      ProdID: eventRow.ProdID,
      ProdName: eventRow.ProdName,
      EventDate: eventRow.EventDate,
      Country: eventRow.Country,
      Venue: eventRow.Vendor,
      Trainer_1: eventRow.Vendor,
      tickets,
    };

    return event;
  }
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

  static getTrainerFeePercent(concatKey: string): number {
    try {
      // Import SQLite service to get fee percentage
      const { FeeParamService } = require('./sqlite');
      const parts = concatKey.split('-');
      if (parts.length >= 4) {
        const [program, category, venue, attendance] = parts;
        const percent = FeeParamService.getPercent(program, category, venue, attendance);
        return percent || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting trainer fee percent:', error);
      return 0;
    }
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
