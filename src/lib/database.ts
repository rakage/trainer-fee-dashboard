import sql, { ConnectionPool, Request } from 'mssql';
import { Pool as PgPool, PoolClient } from 'pg';
import { EventListResponse, EventDetail, EventTicket, TrainerSplit } from '@/types';
import {
  TrainerSplitService,
  ExpenseService,
  FeeParamService,
  AuditService,
  GracePriceService,
} from './postgres';

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
  requestTimeout?: number;
  connectionTimeout?: number;
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
  requestTimeout: 120000, // 120 seconds for complex queries
  connectionTimeout: 30000, // 30 seconds to establish connection
};

let pool: ConnectionPool | null = null;

// PostgreSQL Configuration
interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

const pgConfig: PostgresConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DATABASE || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
};

let pgPool: PgPool | null = null;

export async function getPostgresConnection(): Promise<PgPool> {
  if (!pgPool) {
    pgPool = new PgPool(pgConfig);
    
    pgPool.on('error', (err) => {
      console.error('PostgreSQL pool error:', err);
      pgPool = null;
    });
    
    console.log('Connected to PostgreSQL database');
  }
  
  return pgPool;
}

export async function closePostgresConnection(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    console.log('PostgreSQL connection closed');
  }
}

export async function getConnection(): Promise<ConnectionPool> {
  // If pool exists and is in a good state, return it
  if (pool) {
    try {
      // Check if pool is connected and not currently connecting
      if (pool.connected && !pool.connecting) {
        return pool;
      }
      // If pool is connecting, wait for it
      if (pool.connecting) {
        console.log('Pool is connecting, waiting...');
        return pool;
      }
    } catch (e) {
      // If checking the state fails, reset the pool
      console.log('Pool state check failed, recreating...');
      pool = null;
    }
  }
  
  // Need to create a new connection
  if (pool && !pool.connected && !pool.connecting) {
    console.log('Pool exists but not connected, closing and recreating...');
    try {
      await pool.close();
    } catch (e) {
      // Ignore close errors
    }
    pool = null;
  }
  
  // Create new pool
  pool = new sql.ConnectionPool(config);
  
  // Set up event listeners to track connection state
  pool.on('error', (err) => {
    console.error('Database pool error:', err);
    pool = null;
  });
  
  try {
    await pool.connect();
    console.log('Connected to MSSQL database');
  } catch (err) {
    console.error('Failed to connect to database:', err);
    pool = null;
    throw err;
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
      // Allow long search strings (event titles can be long)
      request.input('q', sql.NVarChar(sql.MAX), query);
    } else {
      request.input('q', sql.NVarChar(sql.MAX), null);
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
            AND EventDate >= DATEADD(MONTH, -5, GETDATE())
            AND EventDate <= DATEFROMPARTS(YEAR(GETDATE()), 12, 31)
      ORDER BY EventDate DESC
    `);

    return result.recordset;
  }

  static async getEventDetail(
    prodId: number,
    includeDeleted: boolean = false
  ): Promise<EventDetail | null> {
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
      , giftcard_usage as (
      SELECT 
        gc.GiftCardCouponCode AS CouponCode,
        gcuh.UsedValue AS UsedAmount,
        gcuh.UsedWithOrderId AS OrderId
    FROM GiftCardUsageHistory gcuh
    INNER JOIN GiftCard gc ON gcuh.GiftCardId = gc.Id
      )
      , final_1 as (
        select 
            a.OrderID, a.DatePaid, a.EventDate, a.ProdID, a.ProdName, a.Category, a.Program,
            a.quantity, a.ProductPrice, a.UnitPrice, a.PriceTotal, a.TierLevel, a.Vendor, a.Country,
            a.CustomerID, a.Customer, 
            case
              when b.OrderId is not null then 'Online Payment'
              else a.PaymentMethod
            end as PaymentMethod
            , a.Attendance, a.PaymentStatus, a.StockQuantity,
            CASE 
                WHEN ProdName LIKE '%Online%' and ProdName LIKE '%Global%' THEN 'OnlineGlobal'
                WHEN ProdName LIKE '%Online%' or ProdName LIKE '%En Linea%' or ProdName LIKE '%En LÃ­nea%' THEN 'Online'
                WHEN ProdName LIKE '%Venue,%' THEN 'Venue'
                WHEN ProdName LIKE '%Presencial%' THEN 'Venue'
                WHEN ProdName LIKE 'ON DEMAND!%' THEN 'On Demand'
                WHEN ProdName LIKE 'ISOLATION INSPIRATION Workshop%' or ProdName LIKE 'SALSATION Workshop with%' THEN 'Venue'
                WHEN @prodId = 68513 THEN 'Venue'
                WHEN ProdName like '%THE SALSATION BLAST%' or ProdName like '%SALSATION Method Training%' THEN 'Venue'
                ELSE NULL
            END AS Location,
            -- Extract trainer name from ProdName
            CASE 
                -- Pattern: "[PROGRAM] [TYPE] with [TRAINER_NAME], [VENUE], [LOCATION] - [COUNTRY], [DATES]"
                WHEN ProdName LIKE '% with %' THEN 
                    LTRIM(RTRIM(
                        CASE 
                            -- Handle multiple trainers with & separator - take first trainer only
                            WHEN CHARINDEX(' & ', SUBSTRING(ProdName, CHARINDEX(' with ', ProdName) + 6, LEN(ProdName))) > 0 THEN
                                SUBSTRING(ProdName, 
                                    CHARINDEX(' with ', ProdName) + 6, 
                                    CHARINDEX(' & ', SUBSTRING(ProdName, CHARINDEX(' with ', ProdName) + 6, LEN(ProdName))) - 1
                                )
                            -- Single trainer
                            ELSE
                                SUBSTRING(ProdName, 
                                    CHARINDEX(' with ', ProdName) + 6, 
                                    CHARINDEX(',', ProdName, CHARINDEX(' with ', ProdName)) - CHARINDEX(' with ', ProdName) - 6
                                )
                        END
                    ))
                -- Fallback to Vendor if no "with" pattern found
                ELSE COALESCE(Vendor, 'Unknown')
            END AS TrainerName
        from finals a
        left join giftcard_usage b on a.OrderID = b.OrderId
        where rn = 1
      )
      select *
            , concat(Program, '-', Category, '-', Location, '-', Attendance) as ConcatTrainerPercentKey
            , case
                when Country = 'Japan' and Location = 'Venue' then concat(Program, '-', Category, '-', TierLevel)
                when Country = 'Japan' and Location = 'Online' then concat(Program, '-', Category, '-', TierLevel, '-', Location)
                else null
            end as GraceKey
      from final_1
    `);

    if (orderResult.recordset.length === 0) {
      // If no orders found, still try to get basic event info
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
            AND p.id = @prodId
        ),
        finals AS (
          SELECT 
            *,
            CASE 
              -- Case 1: "Online" + Location (e.g., "Online, Global" â†’ "OnlineGlobal")
              WHEN ProdName LIKE '%Online%' and ProdName LIKE '%Global%' THEN 'OnlineGlobal'
              -- Case 2: "Online" without specific location
              WHEN ProdName LIKE '%Online%' or ProdName LIKE '%En Linea%' or ProdName LIKE '%En LÃ­nea%' THEN 'Online'
              -- Case 3: "Venue" present in string
              WHEN ProdName LIKE '%Venue,%' THEN 'Venue'
              -- Case 4: "Presencial" (Spanish version of "In-person Venue")
              WHEN ProdName LIKE '%Presencial%' THEN 'Venue'
              -- Case 5: "ON DEMAND!" (special case)
              WHEN ProdName LIKE 'ON DEMAND!%' THEN 'On Demand'
              -- Case 6: "ISOLATION INSPIRATION Workshop"
              WHEN ProdName LIKE 'ISOLATION INSPIRATION Workshop%' or ProdName LIKE 'SALSATION Workshop with%' THEN 'Venue'
              -- Case 7: "Cruise Training"
              WHEN ProdID = 68513 THEN 'Venue'
              -- Case 8: "Salsation Blast"
              WHEN ProdName like '%THE SALSATION BLAST%' or ProdName like '%SALSATION Method Training%' THEN 'Venue'
              -- Default case: NULL
              ELSE NULL
            END AS Location,
            -- Extract trainer name from ProdName
            CASE 
                -- Pattern: "[PROGRAM] [TYPE] with [TRAINER_NAME], [VENUE], [LOCATION] - [COUNTRY], [DATES]"
                WHEN ProdName LIKE '% with %' THEN 
                    LTRIM(RTRIM(
                        CASE 
                            -- Handle multiple trainers with & separator - take first trainer only
                            WHEN CHARINDEX(' & ', SUBSTRING(ProdName, CHARINDEX(' with ', ProdName) + 6, LEN(ProdName))) > 0 THEN
                                SUBSTRING(ProdName, 
                                    CHARINDEX(' with ', ProdName) + 6, 
                                    CHARINDEX(' & ', SUBSTRING(ProdName, CHARINDEX(' with ', ProdName) + 6, LEN(ProdName))) - 1
                                )
                            -- Single trainer
                            ELSE
                                SUBSTRING(ProdName, 
                                    CHARINDEX(' with ', ProdName) + 6, 
                                    CHARINDEX(',', ProdName, CHARINDEX(' with ', ProdName)) - CHARINDEX(' with ', ProdName) - 6
                                )
                        END
                    ))
                -- Fallback to Vendor if no "with" pattern found
                ELSE COALESCE(Vendor, 'Unknown')
            END AS TrainerName,
            ROW_NUMBER() OVER(PARTITION BY ProdID ORDER BY EventDate ASC) as rn
          FROM base
        )
        SELECT ProdID, ProdName, EventDate, Category, Program, Vendor, Country, Location, TrainerName
        FROM finals
        WHERE rn = 1
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
        Venue: eventRow.Location || 'Unknown', // Use calculated Location for Venue
        Trainer_1: this.cleanTrainerName(eventRow.TrainerName || eventRow.Vendor || 'Unknown'), // Clean trainer name
        tickets: [],
      };
    }

    // Group orders by key characteristics and calculate trainer fees using PostgreSQL
    const tickets: EventTicket[] = [];
    const eventRow = orderResult.recordset[0];

    // Group by Attendance, PaymentMethod, TierLevel, and UnitPrice (ticket price can vary per customer)
    const groupedOrders = orderResult.recordset.reduce((acc, order) => {
      const unitPrice = order.PriceTotal || 0; // individual ticket price
      const key = `${order.Attendance}-${order.PaymentMethod}-${order.TierLevel || 'Standard'}-${unitPrice.toFixed(2)}`;
      if (!acc[key]) {
        acc[key] = {
          Attendance: order.Attendance,
          PaymentMethod: order.PaymentMethod,
          TierLevel: order.TierLevel || '',
          UnitPrice: unitPrice,
          Quantity: 0,
          ConcatTrainerPercentKey: order.ConcatTrainerPercentKey,
        };
      }
      // For grouped items, we should use the same unit price and sum the quantities
      acc[key].Quantity += order.quantity || 0;
      return acc;
    }, {} as any);

    // Convert grouped data to tickets and calculate trainer fee percentages
    for (const group of Object.values(groupedOrders) as any[]) {
      // Get the trainer fee percentage from PostgreSQL using the concat key
      const feePercent = await this.getTrainerFeePercent(group.ConcatTrainerPercentKey);

      let unitPrice = group.UnitPrice;
      let priceTotal = group.UnitPrice * group.Quantity;

      // Apply JPY Price Conversion for all events in Japan
      const isJapan =
        eventRow.Country?.toLowerCase().includes('japan') ||
        eventRow.Country?.toLowerCase().includes('jp');

      if (isJapan && group.TierLevel) {
        try {
          // Extract program and category from the event name
          const { program, category } = this.extractProgramAndCategory(eventRow.ProdName || '');
          const tierLevel = group.TierLevel;
          const venue = eventRow.Location || 'Unknown';
          
          // Generate event_type_key to match against database
          let eventTypeKey = `${program}-${category}-${tierLevel === 'Free' ? '' : tierLevel}`;
          if (venue === 'Online') {
            eventTypeKey += '-Online';
          }
          
          console.log('\n=== JPY CONVERSION ATTEMPT ===');
          console.log(`Event: ${eventRow.ProdName}`);
          console.log(`Country: ${eventRow.Country}`);
          console.log(`Venue/Location: ${venue}`);
          console.log(`Generated event_type_key: ${eventTypeKey}`);
          console.log(`EUR Unit Price: ${unitPrice}`);

          // Convert EUR to JPY
          const jpyAmount = await this.convertEurToJpy(unitPrice, program, category, tierLevel, venue);
          if (jpyAmount !== null) {
            unitPrice = jpyAmount;
            priceTotal = jpyAmount * group.Quantity;
            console.log(`✓ MATCH FOUND - Converted to JPY: ¥${jpyAmount.toLocaleString('ja-JP')}`);
          } else {
            console.log('✗ NO MATCH - No conversion found in database');
          }
          console.log('=== END JPY CONVERSION ===\n');
        } catch (error) {
          console.error('Error applying JPY price conversion:', error);
          // Continue with original EUR prices if conversion fails
        }
      }

      tickets.push({
        Attendance: group.Attendance,
        PaymentMethod: group.PaymentMethod,
        TierLevel: group.TierLevel,
        UnitPrice: unitPrice, // Individual ticket price (converted to JPY if applicable)
        PriceTotal: priceTotal, // Total price = unit price Ã— quantity (converted to JPY if applicable)
        TrainerFeePct: feePercent,
        Quantity: group.Quantity,
        Currency: isJapan ? 'JPY' : 'EUR', // Set currency based on country
      });
    }

    // Determine currency display based on country
    const rawTrainerName = eventRow.TrainerName || eventRow.Vendor || 'Unknown';
    const cleanedTrainerName = this.cleanTrainerName(rawTrainerName);
    const isJapan =
      eventRow.Country?.toLowerCase().includes('japan') ||
      eventRow.Country?.toLowerCase().includes('jp');

    const event: EventDetail = {
      ProdID: eventRow.ProdID,
      ProdName: eventRow.ProdName,
      EventDate: eventRow.EventDate,
      Country: eventRow.Country,
      Venue: eventRow.Location || 'Unknown', // Use calculated Location for Venue
      Trainer_1: cleanedTrainerName, // Use cleaned trainer name
      Currency: isJapan ? 'JPY' : 'EUR', // Set event currency based on country
      tickets,
    };

    return event;
  }

  static async getTrainerSplits(prodId: number): Promise<TrainerSplit[]> {
    try {
      // Use PostgreSQL for trainer splits (app-specific data)
      const rows = await TrainerSplitService.getByProdId(prodId);

      return rows.map(
        (row: any, index: number): TrainerSplit => ({
          id: index + 1,
          ProdID: row.prod_id,
          RowId: row.row_id,
          Name: row.name,
          Percent: row.percent,
          TrainerFee: row.trainer_fee || 0,
          CashReceived: row.cash_received,
          Payable: (row.trainer_fee || 0) - (row.cash_received || 0), // Calculate payable from saved values
        })
      );
    } catch (error: any) {
      console.error('Error getting trainer splits from PostgreSQL:', error);
      return [];
    }
  }

  static async saveTrainerSplit(split: TrainerSplit): Promise<void> {
    try {
      // Use PostgreSQL for trainer splits (app-specific data)
      await TrainerSplitService.upsert({
        prod_id: split.ProdID,
        row_id: split.RowId,
        name: split.Name,
        percent: split.Percent,
        trainer_fee: split.TrainerFee || 0,
        cash_received: split.CashReceived,
      });
    } catch (error) {
      console.error('Error saving trainer split to PostgreSQL:', error);
      throw error;
    }
  }

  static async deleteTrainerSplit(prodId: number, rowId: number): Promise<void> {
    try {
      // Use PostgreSQL for trainer splits (app-specific data)
      await TrainerSplitService.delete(prodId, rowId);
    } catch (error) {
      console.error('Error deleting trainer split from PostgreSQL:', error);
      throw error;
    }
  }

  static async getEventExpenses(prodId: number): Promise<any[]> {
    try {
      // Use PostgreSQL for expenses (app-specific data)

      const rows = await ExpenseService.getByProdId(prodId);

      return rows.map((row: any, index: number): any => ({
        id: index + 1,
        ProdID: row.prod_id,
        RowId: row.row_id,
        Description: row.description,
        Amount: row.amount,
      }));
    } catch (error: any) {
      console.error('Error getting expenses from PostgreSQL:', error);
      return [];
    }
  }

  static async saveEventExpense(expense: any): Promise<void> {
    try {
      // Use PostgreSQL for expenses (app-specific data)

      await ExpenseService.upsert({
        prod_id: expense.ProdID,
        row_id: expense.RowId,
        description: expense.Description,
        amount: expense.Amount,
      });
    } catch (error) {
      console.error('Error saving expense to PostgreSQL:', error);
      throw error;
    }
  }

  static async deleteEventExpense(prodId: number, rowId: number): Promise<void> {
    try {
      // Use PostgreSQL for expenses (app-specific data)

      await ExpenseService.delete(prodId, rowId);
    } catch (error) {
      console.error('Error deleting expense from PostgreSQL:', error);
      throw error;
    }
  }

  static async getTrainerFeePercent(concatKey: string): Promise<number> {
    try {
      // Import PostgreSQL service to get fee percentage

      const parts = concatKey.split('-');
      if (parts.length >= 4) {
        const [program, category, venue, attendance] = parts;
        const percent = await FeeParamService.getPercent(program, category, venue, attendance);
        return percent || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting trainer fee percent:', error);
      return 0;
    }
  }

  static async logAuditEvent(
    userId: string,
    action: string,
    prodId: number,
    details: string
  ): Promise<void> {
    try {
      // Use PostgreSQL for audit logging (app-specific data)

      await AuditService.log(userId, action, prodId, details);
    } catch (error) {
      console.error('Failed to log audit event to PostgreSQL:', error);
      // Don't throw error for audit logging failures
    }
  }

  static async getGracePriceConversion(
    program: string,
    category: string,
    tierLevel: string,
    venue?: string
  ): Promise<{ jpyPrice: number; eurPrice: number } | null> {
    try {

      let eventTypeKey = `${program}-${category}-${tierLevel === 'Free' ? '' : tierLevel}`;
      if (venue === 'Online') {
        eventTypeKey += '-Online';
      }

      const conversions = await GracePriceService.getAll();
      
      console.log('--- Database Lookup ---');
      console.log(`Looking for: ${eventTypeKey}`);
      console.log(`Available keys in database (${conversions.length} total):`);
      conversions.forEach((c: any) => {
        console.log(`  - ${c.eventTypeKey} (JPY: ¥${c.jpyPrice.toLocaleString('ja-JP')}, EUR: €${c.eurPrice})`);
      });
      
      const conversion = conversions.find((c: any) => c.eventTypeKey === eventTypeKey);
      
      if (conversion) {
        console.log(`Match found: ${eventTypeKey}`);
      } else {
        console.log(`No match for: ${eventTypeKey}`);
      }

      return conversion
        ? {
            jpyPrice: conversion.jpyPrice,
            eurPrice: conversion.eurPrice,
          }
        : null;
    } catch (error) {
      console.error('Error getting Grace price conversion:', error);
      return null;
    }
  }

  static convertEurToJpy(
    eurAmount: number,
    program: string,
    category: string,
    tierLevel: string,
    venue?: string
  ): Promise<number | null> {
    return new Promise(async (resolve) => {
      try {
        const conversion = await this.getGracePriceConversion(program, category, tierLevel, venue);
        if (!conversion || conversion.eurPrice === 0) {
          resolve(null);
          return;
        }

        // Calculate conversion rate: JPY/EUR
        const conversionRate = conversion.jpyPrice / conversion.eurPrice;
        const jpyAmount = eurAmount * conversionRate;

        resolve(jpyAmount);
      } catch (error) {
        console.error('Error converting EUR to JPY:', error);
        resolve(null);
      }
    });
  }

  static async getAlejandroReport(year?: number, month?: number) {
    try {
      const pool = await getConnection();
      const request = pool.request();

      if (year) {
        request.input('year', sql.Int, year);
      }
      if (month) {
        request.input('month', sql.Int, month);
      }

      const query = `
        with base as (
          select distinct
          p.id as ProdID, 
          p.name as ProdName,  
          c.name as Category, 
          sao2.name as Program,
          CASE 
            WHEN c.name = 'Instructor training' THEN 
              CASE 
                WHEN sao2.name = 'Choreology' THEN 'Choreology Instructor training'
                WHEN sao2.name = 'Kid' THEN 'Kid Instructor training'
                WHEN sao2.name = 'Rootz' THEN 'Rootz Instructor training'
                WHEN sao2.name = 'Salsation' THEN 'Salsation Instructor training'
                ELSE CONCAT(sao2.name, ' ', c.name)
              END
            WHEN c.name = 'Workshops' THEN 
              CASE 
                WHEN sao2.name = 'Choreology' THEN 'Choreology Workshops Venue'
                WHEN sao2.name = 'Rootz' THEN 'Rootz Workshops Venue'
                WHEN sao2.name = 'Salsation' THEN 'Salsation Workshops Venue'
                ELSE CONCAT(sao2.name, ' ', c.name, ' Venue')
              END
            WHEN c.name = 'Seminar' THEN 
              CASE 
                WHEN sao2.name = 'Salsation' THEN 'Salsation Seminar Venue'
                ELSE CONCAT(sao2.name, ' ', c.name, ' Venue')
              END
            WHEN c.name = 'Method Training' THEN 'Salsation Method Training'
            WHEN c.name = 'On Demand' THEN 'Salsation On Demand'
            WHEN c.name = 'On-Demand' THEN 'Salsation On-Demand'
            ELSE CONCAT(sao2.name, ' ', c.name)
          END as ReportingGroup,
          CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE) as EventDate, 
          p.price as ProductPrice, 
          v.Name as Vendor,
          sao.Name as Country,
          p.StockQuantity,
          p.DisableBuyButton as Cancelled,
          case
            when p.Published = 1 then 'Active'
            else 'Cancelled'
          end as Status_Event
          from product p
          left join Product_Category_Mapping pcm
          on p.id = pcm.ProductId
          left join Product_ProductAttribute_Mapping pam
          on p.id = pam.ProductId
          left join SalsationEvent_Country_Mapping scm
          on p.id = scm.ProductId
          left join country cn
          on scm.CountryId = cn.Id
          left join ProductAttributeValue pav
          on pam.id = pav.ProductAttributeMappingId
          left join Category c
          on pcm.CategoryId = c.id
          left join Vendor v 
          on p.VendorId = v.Id
          left join Product_SpecificationAttribute_Mapping psm
          on p.Id = psm.productid
          left join SpecificationAttributeOption sao 
          on psm.SpecificationAttributeOptionId = sao.Id 
          left join SpecificationAttribute sa 
          on sao.SpecificationAttributeId = sa.Id
          left join Product_SpecificationAttribute_Mapping psm2
          on p.Id = psm2.productid
          left join SpecificationAttributeOption sao2 
          on psm2.SpecificationAttributeOptionId = sao2.Id 
          left join SpecificationAttribute sa2 
          on sao2.SpecificationAttributeId = sa2.Id
          where sa.id = 10
          and sa2.id = 6
          and (pav.name like '%2024%'
          or pav.name like '%2025%')
          and p.id not in ('53000', '55053')
          ${year ? "AND YEAR(CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE)) = @year" : ''}
          ${month ? "AND MONTH(CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE)) = @month" : ''}
        )
        , finals as (
          select 
            *
            , row_number() over(partition by ProdID order by eventdate asc) as rn
          from base
        )
        , EventDataRaw as (
          select 
            ProdID,
            ProdName,
            Category,
            Program,
            ReportingGroup,
            EventDate,
            ProductPrice,
            Vendor,
            Country,
            StockQuantity,
            Cancelled,
            Status_Event
          from finals
          where rn = 1
        )
        , base_order as (
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
            oi.PriceInclTax - o.RefundedAmount as PriceTotal,
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
            left join OrderItem oi
            on p.id = oi.ProductId
            left join [Order] o
            on oi.OrderId = o.id
            left join Product_Category_Mapping pcm
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm
            on p.id = scm.ProductId
            left join country cn
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav
            on pam.id = pav.ProductAttributeMappingId
            left join Category c
            on pcm.CategoryId = c.id
            left join Vendor v 
            on p.VendorId = v.Id
            left join Customer cu
            on o.CustomerId = cu.id
            left join customer_customerrole_mapping crm
            on cu.id = crm.customer_id
            left join customerrole cr 
            on crm.customerrole_id = cr.id
            left join Product_SpecificationAttribute_Mapping psm
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao 
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa 
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 
            on sao2.SpecificationAttributeId = sa2.Id
            left join SalsationSubscriber ss 
            on (oi.Id = ss.OrderItemId
            and cu.id = ss.CustomerId
            and p.id = ss.parentid
            and o.id = ss.orderid)
            left join TierPrice tp
            on (p.id = tp.productId
            --and cr.id = tp.customerroleid
            and oi.PriceInclTax = tp.price
            and oi.Quantity = tp.Quantity)
            where sa.id = 10
            and sa2.id = 6
            and o.orderstatusid = '30'
            and o.paymentstatusid in ('30','35')
            -- and p.DisableBuyButton = 0
            and (p.Published = 1
            or (p.id = '40963' and p.Published = 0))
            and (pav.name like '%2024%'
            or pav.name like '%2025%')
            and p.id not in ('54958', '53000', '55053')
            -- and p.id in ('75080')
            --and o.id in ('')
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
            oi.PriceInclTax - o.RefundedAmount as PriceTotal,
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
            left join OrderItem oi
            on p.id = oi.ProductId
            left join [Order] o
            on oi.OrderId = o.id
            left join Product_Category_Mapping pcm
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm
            on p.id = scm.ProductId
            left join country cn
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav
            on pam.id = pav.ProductAttributeMappingId
            left join Category c
            on pcm.CategoryId = c.id
            left join Vendor v 
            on p.VendorId = v.Id
            left join Customer cu
            on o.CustomerId = cu.id
            left join customer_customerrole_mapping crm
            on cu.id = crm.customer_id
            left join customerrole cr 
            on crm.customerrole_id = cr.id
            left join Product_SpecificationAttribute_Mapping psm
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao 
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa 
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 
            on sao2.SpecificationAttributeId = sa2.Id
            left join SalsationSubscriber ss 
            on (oi.Id = ss.OrderItemId
            and cu.id = ss.CustomerId
            and p.id = ss.parentid
            and o.id = ss.orderid)
            left join TierPrice tp
            on (p.id = tp.productId
            --and cr.id = tp.customerroleid
            and oi.PriceInclTax = tp.price
            and oi.Quantity = tp.Quantity)
            where sa.id = 10
            and sa2.id = 6
            and o.orderstatusid = '30'
            and o.paymentstatusid in ('30','35')
            -- and p.DisableBuyButton = 0
            and p.id in ('54958')
            and p.id not in ('53000', '55053')
            and (o.PaidDateUtc like '%2024%'
            or o.PaidDateUtc like '%2025%')
            )
            , finals_order as (
            select
                *
                , row_number() over(partition by orderid, customerid, prodid order by eventdate asc) rn
            from base_order
            )
            , orderdataraw as (
            select 
            OrderID,
            DatePaid,
            EventDate,
            ProdID,
            ProdName,
            Category,
            Program,
            quantity,
            ProductPrice,
            UnitPrice,
            PriceTotal,
            TierLevel,
            Vendor,
            Country,
            CustomerID,
            Customer,
            PaymentMethod,
            Attendance,
            PaymentStatus,
            StockQuantity
            --rn
            from finals_order
            where rn = 1
            )
            , OrderData as (
            select 
                ProdID as ProductId,
                SUM(quantity) as TotalTickets,
                SUM(PriceTotal) as TotalRevenue
            from orderdataraw
            group by ProdID
        )
        , final_report as (
        select 
          MONTH(e.EventDate) as Month,
          YEAR(e.EventDate) as Year,
          e.ProdID,
          e.ProdName,
          e.Category,
          e.Program,
          e.EventDate,
          e.Country,
          e.ReportingGroup,
          CASE 
                -- Pattern: "[PROGRAM] [TYPE] with [TRAINER_NAME], [VENUE], [LOCATION] - [COUNTRY], [DATES]"
                WHEN e.ProdName LIKE '% with %' THEN 
                    LTRIM(RTRIM(
                        CASE 
                            -- Handle multiple trainers with & separator - take first trainer only
                            WHEN CHARINDEX(' & ', SUBSTRING(e.ProdName, CHARINDEX(' with ', e.ProdName) + 6, LEN(e.ProdName))) > 0 THEN
                                SUBSTRING(e.ProdName, 
                                    CHARINDEX(' with ', e.ProdName) + 6, 
                                    CHARINDEX(' & ', SUBSTRING(e.ProdName, CHARINDEX(' with ', e.ProdName) + 6, LEN(e.ProdName))) - 1
                                )
                            -- Single trainer
                            ELSE
                                SUBSTRING(e.ProdName, 
                                    CHARINDEX(' with ', e.ProdName) + 6, 
                                    CHARINDEX(',', e.ProdName, CHARINDEX(' with ', e.ProdName)) - CHARINDEX(' with ', e.ProdName) - 6
                                )
                        END
                    ))
                -- Fallback to Vendor if no "with" pattern found
                ELSE COALESCE(e.Vendor, 'Unknown')
            END AS TrainerName,
          COALESCE(od.TotalTickets, 0) as TotalTickets,
          COALESCE(od.TotalRevenue, 0) as TotalRevenue
        from EventDataRaw e
        left join OrderData od on e.ProdID = od.ProductId
        where e.Category in ('Instructor training', 'Method Training')
        )
        select *
        from final_report
        where TrainerName not like '%Alejandro%'
        order by Month asc, Year asc, ProdID asc
      `;

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error fetching Alejandro report:', error);
      throw error;
    }
  }

  static async getAlejandroEvents(year?: number, month?: number) {
    try {
      const pool = await getConnection();
      const request = pool.request();

      if (year) {
        request.input('year', sql.Int, year);
      }
      if (month) {
        request.input('month', sql.Int, month);
      }

      const query = `
        with base as (
          select distinct
          p.id as ProdID, 
          p.name as ProdName,  
          c.name as Category, 
          sao2.name as Program,
          CASE 
            WHEN c.name = 'Instructor training' THEN 
              CASE 
                WHEN sao2.name = 'Choreology' THEN 'Choreology Instructor training'
                WHEN sao2.name = 'Kid' THEN 'Kid Instructor training'
                WHEN sao2.name = 'Rootz' THEN 'Rootz Instructor training'
                WHEN sao2.name = 'Salsation' THEN 'Salsation Instructor training'
                ELSE CONCAT(sao2.name, ' ', c.name)
              END
            WHEN c.name = 'Workshops' THEN 
              CASE 
                WHEN sao2.name = 'Choreology' THEN 'Choreology Workshops Venue'
                WHEN sao2.name = 'Rootz' THEN 'Rootz Workshops Venue'
                WHEN sao2.name = 'Salsation' THEN 'Salsation Workshops Venue'
                ELSE CONCAT(sao2.name, ' ', c.name, ' Venue')
              END
            WHEN c.name = 'Seminar' THEN 
              CASE 
                WHEN sao2.name = 'Salsation' THEN 'Salsation Seminar Venue'
                ELSE CONCAT(sao2.name, ' ', c.name, ' Venue')
              END
            WHEN c.name = 'Method Training' THEN 'Salsation Method Training'
            WHEN c.name = 'On Demand' THEN 'Salsation On Demand'
            WHEN c.name = 'On-Demand' THEN 'Salsation On-Demand'
            ELSE CONCAT(sao2.name, ' ', c.name)
          END as ReportingGroup,
          CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE) as EventDate, 
          p.price as ProductPrice, 
          v.Name as Vendor,
          sao.Name as Country,
          p.StockQuantity,
          p.DisableBuyButton as Cancelled,
          case
            when p.Published = 1 then 'Active'
            else 'Cancelled'
          end as Status_Event
          from product p
          left join Product_Category_Mapping pcm
          on p.id = pcm.ProductId
          left join Product_ProductAttribute_Mapping pam
          on p.id = pam.ProductId
          left join SalsationEvent_Country_Mapping scm
          on p.id = scm.ProductId
          left join country cn
          on scm.CountryId = cn.Id
          left join ProductAttributeValue pav
          on pam.id = pav.ProductAttributeMappingId
          left join Category c
          on pcm.CategoryId = c.id
          left join Vendor v 
          on p.VendorId = v.Id
          left join Product_SpecificationAttribute_Mapping psm
          on p.Id = psm.productid
          left join SpecificationAttributeOption sao 
          on psm.SpecificationAttributeOptionId = sao.Id 
          left join SpecificationAttribute sa 
          on sao.SpecificationAttributeId = sa.Id
          left join Product_SpecificationAttribute_Mapping psm2
          on p.Id = psm2.productid
          left join SpecificationAttributeOption sao2 
          on psm2.SpecificationAttributeOptionId = sao2.Id 
          left join SpecificationAttribute sa2 
          on sao2.SpecificationAttributeId = sa2.Id
          where sa.id = 10
          and sa2.id = 6
          and (pav.name like '%2024%'
          or pav.name like '%2025%')
          and p.id not in ('53000', '55053')
          ${year ? "AND YEAR(CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE)) = @year" : ''}
          ${month ? "AND MONTH(CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE)) = @month" : ''}
        )
        , finals as (
          select 
            *
            , row_number() over(partition by ProdID order by eventdate asc) as rn
          from base
        )
        , EventDataRaw as (
          select 
            ProdID,
            ProdName,
            Category,
            Program,
            ReportingGroup,
            EventDate,
            ProductPrice,
            Vendor,
            Country,
            StockQuantity,
            Cancelled,
            Status_Event
          from finals
          where rn = 1
        )
        , base_order as (
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
            oi.PriceInclTax - o.RefundedAmount as PriceTotal,
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
            left join OrderItem oi
            on p.id = oi.ProductId
            left join [Order] o
            on oi.OrderId = o.id
            left join Product_Category_Mapping pcm
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm
            on p.id = scm.ProductId
            left join country cn
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav
            on pam.id = pav.ProductAttributeMappingId
            left join Category c
            on pcm.CategoryId = c.id
            left join Vendor v 
            on p.VendorId = v.Id
            left join Customer cu
            on o.CustomerId = cu.id
            left join customer_customerrole_mapping crm
            on cu.id = crm.customer_id
            left join customerrole cr 
            on crm.customerrole_id = cr.id
            left join Product_SpecificationAttribute_Mapping psm
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao 
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa 
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 
            on sao2.SpecificationAttributeId = sa2.Id
            left join SalsationSubscriber ss 
            on (oi.Id = ss.OrderItemId
            and cu.id = ss.CustomerId
            and p.id = ss.parentid
            and o.id = ss.orderid)
            left join TierPrice tp
            on (p.id = tp.productId
            --and cr.id = tp.customerroleid
            and oi.PriceInclTax = tp.price
            and oi.Quantity = tp.Quantity)
            where sa.id = 10
            and sa2.id = 6
            and o.orderstatusid = '30'
            and o.paymentstatusid in ('30','35')
            -- and p.DisableBuyButton = 0
            and (p.Published = 1
            or (p.id = '40963' and p.Published = 0))
            and (pav.name like '%2024%'
            or pav.name like '%2025%')
            and p.id not in ('54958', '53000', '55053')
            -- and p.id in ('75080')
            --and o.id in ('')
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
            oi.PriceInclTax - o.RefundedAmount as PriceTotal,
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
            left join OrderItem oi
            on p.id = oi.ProductId
            left join [Order] o
            on oi.OrderId = o.id
            left join Product_Category_Mapping pcm
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm
            on p.id = scm.ProductId
            left join country cn
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav
            on pam.id = pav.ProductAttributeMappingId
            left join Category c
            on pcm.CategoryId = c.id
            left join Vendor v 
            on p.VendorId = v.Id
            left join Customer cu
            on o.CustomerId = cu.id
            left join customer_customerrole_mapping crm
            on cu.id = crm.customer_id
            left join customerrole cr 
            on crm.customerrole_id = cr.id
            left join Product_SpecificationAttribute_Mapping psm
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao 
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa 
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 
            on sao2.SpecificationAttributeId = sa2.Id
            left join SalsationSubscriber ss 
            on (oi.Id = ss.OrderItemId
            and cu.id = ss.CustomerId
            and p.id = ss.parentid
            and o.id = ss.orderid)
            left join TierPrice tp
            on (p.id = tp.productId
            --and cr.id = tp.customerroleid
            and oi.PriceInclTax = tp.price
            and oi.Quantity = tp.Quantity)
            where sa.id = 10
            and sa2.id = 6
            and o.orderstatusid = '30'
            and o.paymentstatusid in ('30','35')
            -- and p.DisableBuyButton = 0
            and p.id in ('54958')
            and p.id not in ('53000', '55053')
            and (o.PaidDateUtc like '%2024%'
            or o.PaidDateUtc like '%2025%')
            )
            , finals_order as (
            select
                *
                , row_number() over(partition by orderid, customerid, prodid order by eventdate asc) rn
            from base_order
            )
            , orderdataraw as (
            select 
            OrderID,
            DatePaid,
            EventDate,
            ProdID,
            ProdName,
            Category,
            Program,
            quantity,
            ProductPrice,
            UnitPrice,
            PriceTotal,
            TierLevel,
            Vendor,
            Country,
            CustomerID,
            Customer,
            PaymentMethod,
            Attendance,
            PaymentStatus,
            StockQuantity
            --rn
            from finals_order
            where rn = 1
            )
            , OrderData as (
            select 
                ProdID as ProductId,
                SUM(quantity) as TotalTickets,
                SUM(PriceTotal) as TotalRevenue
            from orderdataraw
            group by ProdID
        )
        , cotrainers as (
            select distinct ParentId as ProdID, CustomerId, c.name
            from SalsationSubscriber a
            left join Customer b
            on a.customerid = b.id
            left join vendor c
            on b.VendorId = c.id
            where IsCoInstructor = 1
        )
        , finals_cotrainers as (
            select
                ProdID,
                STRING_AGG(name, ', ') AS cotrainers_name
            from cotrainers
            group by prodid
        )
        , ExtractedTrainers AS ( 
            SELECT
                e.ProdID,
                e.ProdName,
                CONCAT(e.Vendor, CASE WHEN fc.cotrainers_name IS NOT NULL THEN CONCAT(', ', fc.cotrainers_name) ELSE '' END) AS TrainerList,
                MONTH(e.EventDate) as Month,
                YEAR(e.EventDate) as Year,
                e.Category,
                e.Program,
                e.EventDate,
                e.Country,
                e.ReportingGroup,
                COALESCE(od.TotalTickets, 0) as TotalTickets,
                COALESCE(od.TotalRevenue, 0) as TotalRevenue
            FROM EventDataRaw e
            left join OrderData od on e.ProdID = od.ProductId
            left join finals_cotrainers fc on e.ProdID = fc.ProdID
        )
        , CleanedTrainers AS (
            SELECT 
                prodid, 
                prodname, 
                TrainerList,
                Month, Year, Category, Program, EventDate, Country, ReportingGroup, TotalTickets, TotalRevenue,
                LTRIM(RTRIM(Split.value('.', 'varchar(255)'))) AS SplitPart,
                ROW_NUMBER() OVER (PARTITION BY prodid ORDER BY (SELECT NULL)) AS PartNum
            FROM (
                SELECT 
                    prodid, 
                    prodname, 
                    TrainerList,
                    Month, Year, Category, Program, EventDate, Country, ReportingGroup, TotalTickets, TotalRevenue,
                    CAST('<X>' + REPLACE(REPLACE(REPLACE(TrainerList, ' & ', ','), ',', '</X><X>'), '&', '&amp;') + '</X>' AS XML) AS TrainersXML
                FROM ExtractedTrainers
                WHERE TrainerList IS NOT NULL
            ) AS t
            CROSS APPLY TrainersXML.nodes('/X') AS Trainers(Split)
        )
        , FinalSplit AS (
            SELECT 
                prodid,
                prodname,
                TrainerList,
                Month, Year, Category, Program, EventDate, Country, ReportingGroup, TotalTickets, TotalRevenue,
                CASE PartNum 
                    WHEN 1 THEN TRIM(SplitPart)  -- First trainer
                    ELSE NULL 
                END as Trainer1,
                CASE PartNum 
                    WHEN 2 THEN TRIM(SplitPart)  -- Second trainer
                    ELSE NULL 
                END as CoTrainer1,
                CASE PartNum 
                    WHEN 3 THEN TRIM(SplitPart)  -- Third trainer
                    ELSE NULL 
                END as CoTrainer2,
                CASE PartNum 
                    WHEN 4 THEN TRIM(SplitPart)  -- Fourth trainer
                    ELSE NULL 
                END as CoTrainer3
            FROM CleanedTrainers
        )
        , data_trainers as (
            SELECT 
                prodid,
                prodname,
                TrainerList,
                Month, Year, Category, Program, EventDate, Country, ReportingGroup, TotalTickets, TotalRevenue,
                MAX(Trainer1) as mainTrainer,
                case when MAX(CoTrainer1) = '' then NULL
                else MAX(CoTrainer1)
                end as CoTrainer1,
                case when MAX(CoTrainer2) = '' then NULL
                else MAX(CoTrainer2)
                end as CoTrainer2,
                case when MAX(CoTrainer3) = '' then NULL
                else MAX(CoTrainer3)
                end as CoTrainer3
            FROM FinalSplit
            GROUP BY prodid, prodname, TrainerList, Month, Year, Category, Program, EventDate, Country, ReportingGroup, TotalTickets, TotalRevenue
        )
        , final_report as (
            select 
                Month, Year, ProdID, ProdName, Category, Program, EventDate, Country, ReportingGroup,
                TotalTickets, TotalRevenue,
                case
                    when TrainerList = 'Kami & Yoyo' then 'Kami/Yoyo'
                    when TrainerList = 'Kukizz & Javier' then 'Kukizz/Javier'
                    else mainTrainer
                end as MainTrainer,
                case
                    when TrainerList = 'Kami & Yoyo' then NULL
                    when TrainerList = 'Kukizz & Javier' then NULL
                    else CoTrainer1
                end as CoTrainer1,
                CoTrainer2,
                CoTrainer3
            from data_trainers
        )
        select *
        from final_report
        where MainTrainer like '%Alejandro%' OR CoTrainer1 like '%Alejandro%' OR CoTrainer2 like '%Alejandro%' OR CoTrainer3 like '%Alejandro%'
        order by Month asc, Year asc, ProdID asc
      `;

      const result = await request.query(query);
      const events = result.recordset;

      // Now get expenses data for each event using PostgreSQL


      // Add expenses data to each event
      const eventsWithExpenses = await Promise.all(events.map(async (event: any) => {
        try {
          const expenses = await ExpenseService.getByProdId(event.ProdID);
          const totalExpenses = expenses.reduce(
            (sum: number, expense: any) => sum + (expense.amount || 0),
            0
          );

          // Calculate the net revenue (Total Revenue - Total Expenses)
          const netRevenue = event.TotalRevenue - totalExpenses;

          // Determine the trainer fee percentage based on event characteristics
          // We need to construct the ConcatTrainerPercentKey from the event data
          // Format: Program-Category-Venue-Attendance
          const program = event.Program || '';
          const category = event.Category || '';

          // Determine venue/location based on event name patterns (similar to existing logic)
          let venue = 'Venue'; // Default
          if (event.ProdName) {
            const prodNameLower = event.ProdName.toLowerCase();
            if (prodNameLower.includes('online') && prodNameLower.includes('global')) {
              venue = 'OnlineGlobal';
            } else if (
              prodNameLower.includes('online') ||
              prodNameLower.includes('en linea') ||
              prodNameLower.includes('en línea')
            ) {
              venue = 'Online';
            } else if (prodNameLower.includes('venue,') || prodNameLower.includes('presencial')) {
              venue = 'Venue';
            } else if (prodNameLower.includes('on demand')) {
              venue = 'On Demand';
            } else if (
              prodNameLower.includes('isolation inspiration workshop') ||
              prodNameLower.includes('salsation workshop with')
            ) {
              venue = 'Venue';
            } else if (event.ProdID === 68513) {
              venue = 'Venue'; // Cruise Training
            } else if (
              prodNameLower.includes('the salsation blast') ||
              prodNameLower.includes('salsation method training')
            ) {
              venue = 'Venue';
            }
          }

          // For attendance, we use the most common scenario for Alejandro's events
          // This might need adjustment based on actual event data
          const attendance = 'Attended'; // Default assumption

          const concatKey = `${program}-${category}-${venue}-${attendance}`;

          // Get the proper trainer fee percentage
          const trainerFeePercent = await this.getTrainerFeePercent(concatKey);

          // Calculate Alejandro Fee: (Total Revenue - Total Expenses) * Trainer Fee %
          // Note: trainerFeePercent is already in decimal format (0.3 for 30%)
          const alejandroFee = netRevenue * trainerFeePercent;

          return {
            ...event,
            TotalExpenses: totalExpenses,
            AlejandroFee: alejandroFee,
            ExpenseCount: expenses.length,
            TrainerFeePercent: trainerFeePercent,
            NetRevenue: netRevenue,
          };
        } catch (error) {
          console.error(`Error getting expenses for ProdID ${event.ProdID}:`, error);
          return {
            ...event,
            TotalExpenses: 0,
            AlejandroFee: 0, // Default to 0 if calculation fails
            ExpenseCount: 0,
            TrainerFeePercent: 0,
            NetRevenue: event.TotalRevenue,
          };
        }
      }));

      return eventsWithExpenses;
    } catch (error) {
      console.error('Error fetching Alejandro events:', error);
      throw error;
    }
  }

  static extractProgramAndCategory(eventName: string): { program: string; category: string } {
    const eventNameLower = eventName.toLowerCase();

    // Extract program
    let program = 'Salsation'; // Default
    if (eventNameLower.includes('choreology')) {
      program = 'Choreology';
    } else if (eventNameLower.includes('kid')) {
      program = 'Kid';
    } else if (eventNameLower.includes('rootz')) {
      program = 'Rootz';
    }

    // Extract category
    let category = 'Instructor training'; // Default
    if (eventNameLower.includes('workshop')) {
      category = 'Workshops';
    } else if (eventNameLower.includes('seminar')) {
      category = 'Seminar';
    } else if (eventNameLower.includes('method training')) {
      category = 'Method Training';
    } else if (eventNameLower.includes('on demand')) {
      category = 'On Demand';
    }

    return { program, category };
  }

  static cleanTrainerName(trainerName: string): string {
    // Standardize trainer names, especially for trainer pairs
    switch (trainerName.trim()) {
      case 'Kamila Wierzynska':
        return 'Kami/Yoyo';
      case 'Yoandro':
        return 'Kami/Yoyo';
      case 'Diana Kukizz KurucovÃ¡':
        return 'Kukizz/Javier';
      case 'Javier':
        return 'Kukizz/Javier';
      default:
        return trainerName;
    }
  }

  // TODO: Implement this as a SQL Server Stored Procedure for better performance
  // This would run your full query and return aggregate totals for the cards
  /*
  static async getTrainersEventsSummary(year?: number, month?: number) {
    // This needs to run your FULL 20+ CTE query to calculate:
    // - totalEvents: COUNT(DISTINCT prodid)
    // - uniqueTrainers: COUNT(DISTINCT trainer)
    // - totalTickets: SUM(totaltickets)
    // - totalRevenue: SUM(totalrevenue)
    // Recommended: Create a stored procedure in SQL Server for this
  }
  */

  static async getTrainersEventsSummary(year?: number, month?: number, search?: string, trainers?: string[], programs?: string[], categories?: string[]) {
    try {
      const pool = await getPostgresConnection();
      
      const params: any[] = [];
      let paramIndex = 1;
      
      // Build WHERE conditions
      const conditions: string[] = [];
      
      if (year) {
        conditions.push(`year = $${paramIndex}`);
        params.push(year);
        paramIndex++;
      }
      
      if (month) {
        conditions.push(`month = $${paramIndex}`);
        params.push(month);
        paramIndex++;
      }
      
      if (search) {
        conditions.push(`(
          CAST(prodid AS TEXT) ILIKE $${paramIndex}
          OR prodname ILIKE $${paramIndex}
          OR country ILIKE $${paramIndex}
          OR trainer ILIKE $${paramIndex}
          OR program ILIKE $${paramIndex}
          OR category ILIKE $${paramIndex}
          OR location ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      if (trainers && trainers.length > 0) {
        const trainerPlaceholders = trainers.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`trainer IN (${trainerPlaceholders})`);
        params.push(...trainers);
        paramIndex += trainers.length;
      }
      
      if (programs && programs.length > 0) {
        const programPlaceholders = programs.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`program IN (${programPlaceholders})`);
        params.push(...programs);
        paramIndex += programs.length;
      }
      
      if (categories && categories.length > 0) {
        const categoryPlaceholders = categories.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`category IN (${categoryPlaceholders})`);
        params.push(...categories);
        paramIndex += categories.length;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      const query = `
        SELECT 
          COUNT(DISTINCT prodid) AS "totalEvents",
          COUNT(DISTINCT trainer) AS "uniqueTrainers",
          COALESCE(SUM(paidtickets + ticketsfree), 0) AS "totalTickets",
          COALESCE(SUM(totalrevenue), 0) AS "totalRevenue",
          COALESCE(SUM(revenueaftercommission), 0) AS "totalProfit"
        FROM public.trainer_productivity
        ${whereClause}
      `;

      const result = await pool.query(query, params);
      return result.rows[0] || { totalEvents: 0, uniqueTrainers: 0, totalTickets: 0, totalRevenue: 0, totalProfit: 0 };
    } catch (error) {
      console.error('Error fetching trainers events summary:', error);
      throw error;
    }
  }

  static async getTrainersEventsOld(year?: number, month?: number, page: number = 1, pageSize: number = 50) {
    try {
      const pool = await getConnection();
      const request = pool.request();
      
      // Set a longer timeout for this complex query (120 seconds)
      (request as any).timeout = 120000;

      if (year) {
        request.input('year', sql.Int, year);
      }
      if (month) {
        request.input('month', sql.Int, month);
      }
      
      // Pagination parameters
      const offset = (page - 1) * pageSize;
      request.input('offset', sql.Int, offset);
      request.input('pageSize', sql.Int, pageSize);

      // Your original query with pagination optimization at the start
      const query = `
        -- Pagination CTEs: Filter events BEFORE processing through your complex logic
        WITH PaginatedEvents as (
            select distinct
            p.id as ProdID, 
            p.name as ProdName,  
            c.name as Category, 
            sao2.name as Program,
            null as ReportingGroup,
            CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE) as EventDate, 
            p.price as ProductPrice, 
            v.Name as Vendor,
            sao.Name as Country,
            p.StockQuantity,
            p.DisableBuyButton as Cancelled,
            case
                when p.Published = 1 then 'Active'
                else 'Cancelled'
            end as Status_Event
            from product p WITH (NOLOCK)
            left join Product_Category_Mapping pcm WITH (NOLOCK)
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam WITH (NOLOCK)
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm WITH (NOLOCK)
            on p.id = scm.ProductId
            left join country cn WITH (NOLOCK)
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav WITH (NOLOCK)
            on pam.id = pav.ProductAttributeMappingId
            left join Category c WITH (NOLOCK)
            on pcm.CategoryId = c.id
            left join Vendor v WITH (NOLOCK)
            on p.VendorId = v.Id
            left join Product_SpecificationAttribute_Mapping psm WITH (NOLOCK)
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao WITH (NOLOCK)
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa WITH (NOLOCK)
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2 WITH (NOLOCK)
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 WITH (NOLOCK)
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 WITH (NOLOCK)
            on sao2.SpecificationAttributeId = sa2.Id
            where sa.id = 10
            and sa2.id = 6
            ${year ? "AND pav.name like '%' + CAST(@year AS VARCHAR(4)) + '%'" : "AND (pav.name like '%2024%' or pav.name like '%2025%')"}
            ${month ? "AND MONTH(CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE)) = @month" : ''}
            and p.id not in ('53000', '55053')
            )
            , finals as (
            select 
                *
                , row_number() over(partition by ProdID order by eventdate asc) as rn
            from base
            )
            , EventDataRaw as (
            select 
                ProdID,
            ProdName,
            Category,
            Program,
            ReportingGroup,
            EventDate,
            ProductPrice,
            Vendor,
            Country,
            StockQuantity,
            Cancelled,
            Status_Event
            from finals
            where 1=1
            and rn = 1
            )
            , base_order as (
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
            oi.PriceInclTax - o.RefundedAmount as PriceTotal,
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
            from product p WITH (NOLOCK)
            left join OrderItem oi WITH (NOLOCK)
            on p.id = oi.ProductId
            left join [Order] o WITH (NOLOCK)
            on oi.OrderId = o.id
            left join Product_Category_Mapping pcm WITH (NOLOCK)
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam WITH (NOLOCK)
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm WITH (NOLOCK)
            on p.id = scm.ProductId
            left join country cn WITH (NOLOCK)
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav WITH (NOLOCK)
            on pam.id = pav.ProductAttributeMappingId
            left join Category c WITH (NOLOCK)
            on pcm.CategoryId = c.id
            left join Vendor v WITH (NOLOCK)
            on p.VendorId = v.Id
            left join Customer cu WITH (NOLOCK)
            on o.CustomerId = cu.id
            left join customer_customerrole_mapping crm WITH (NOLOCK)
            on cu.id = crm.customer_id
            left join customerrole cr WITH (NOLOCK)
            on crm.customerrole_id = cr.id
            left join Product_SpecificationAttribute_Mapping psm WITH (NOLOCK)
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao WITH (NOLOCK)
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa WITH (NOLOCK)
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2 WITH (NOLOCK)
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 WITH (NOLOCK)
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 WITH (NOLOCK)
            on sao2.SpecificationAttributeId = sa2.Id
            left join SalsationSubscriber ss WITH (NOLOCK)
            on (oi.Id = ss.OrderItemId
            and cu.id = ss.CustomerId
            and p.id = ss.parentid
            and o.id = ss.orderid)
            left join TierPrice tp WITH (NOLOCK)
            on (p.id = tp.productId
            and oi.PriceInclTax = tp.price
            and oi.Quantity = tp.Quantity)
            where sa.id = 10
            and sa2.id = 6
            and o.orderstatusid = '30'
            and o.paymentstatusid in ('30','35')
            and (p.Published = 1
            or (p.id = '40963' and p.Published = 0))
            and p.id not in ('54958', '53000', '55053')
            ${year ? "AND pav.name like '%' + CAST(@year AS VARCHAR(4)) + '%'" : "AND (pav.name like '%2024%' or pav.name like '%2025%')"}
            ${month ? "AND MONTH(CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE)) = @month" : ''}
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
            oi.PriceInclTax - o.RefundedAmount as PriceTotal,
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
            from product p WITH (NOLOCK)
            left join OrderItem oi WITH (NOLOCK)
            on p.id = oi.ProductId
            left join [Order] o WITH (NOLOCK)
            on oi.OrderId = o.id
            left join Product_Category_Mapping pcm WITH (NOLOCK)
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam WITH (NOLOCK)
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm WITH (NOLOCK)
            on p.id = scm.ProductId
            left join country cn WITH (NOLOCK)
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav WITH (NOLOCK)
            on pam.id = pav.ProductAttributeMappingId
            left join Category c WITH (NOLOCK)
            on pcm.CategoryId = c.id
            left join Vendor v WITH (NOLOCK)
            on p.VendorId = v.Id
            left join Customer cu WITH (NOLOCK)
            on o.CustomerId = cu.id
            left join customer_customerrole_mapping crm WITH (NOLOCK)
            on cu.id = crm.customer_id
            left join customerrole cr WITH (NOLOCK)
            on crm.customerrole_id = cr.id
            left join Product_SpecificationAttribute_Mapping psm WITH (NOLOCK)
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao WITH (NOLOCK)
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa WITH (NOLOCK)
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2 WITH (NOLOCK)
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 WITH (NOLOCK)
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 WITH (NOLOCK)
            on sao2.SpecificationAttributeId = sa2.Id
            left join SalsationSubscriber ss WITH (NOLOCK)
            on (oi.Id = ss.OrderItemId
            and cu.id = ss.CustomerId
            and p.id = ss.parentid
            and o.id = ss.orderid)
            left join TierPrice tp WITH (NOLOCK)
            on (p.id = tp.productId
            and oi.PriceInclTax = tp.price
            and oi.Quantity = tp.Quantity)
            where sa.id = 10
            and sa2.id = 6
            and o.orderstatusid = '30'
            and o.paymentstatusid in ('30','35')
            and p.id in ('54958')
            and p.id not in ('53000', '55053')
            ${year ? "AND YEAR(o.PaidDateUtc) = @year" : "AND (o.PaidDateUtc like '%2024%' or o.PaidDateUtc like '%2025%')"}
            ${month ? "AND MONTH(o.PaidDateUtc) = @month" : ''}
            )
        ) as SummaryData
      `;

      const result = await request.query(query);
      return result.recordset[0];
    } catch (error) {
      console.error('Error fetching trainers events summary:', error);
      throw error;
    }
  }

  static async getUniqueTrainers(): Promise<{ trainer: string }[]> {
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        const pool = await getPostgresConnection();

        const query = `
          SELECT DISTINCT trainer
          FROM public.trainer_productivity
          WHERE trainer IS NOT NULL
            AND trainer <> ''
          ORDER BY trainer
        `;

        const result = await pool.query(query);
        return result.rows;
      } catch (error: any) {
        console.error(`Error fetching unique trainers (attempt ${retries + 1}/${maxRetries + 1}):`, error);
        
        if (error.code === 'ECONNCLOSED' && retries < maxRetries) {
          retries++;
          console.log(`Retrying getUniqueTrainers... (attempt ${retries + 1})`);
          // Reset the pool to force reconnection
          pgPool = null;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Failed to fetch unique trainers after retries');
  }

  static async getUniquePrograms(): Promise<{ program: string }[]> {
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        const pool = await getPostgresConnection();

        const query = `
          SELECT DISTINCT program
          FROM public.trainer_productivity
          WHERE program IS NOT NULL
            AND program <> ''
          ORDER BY program
        `;

        const result = await pool.query(query);
        return result.rows;
      } catch (error: any) {
        console.error(`Error fetching unique programs (attempt ${retries + 1}/${maxRetries + 1}):`, error);
        
        if (error.code === 'ECONNCLOSED' && retries < maxRetries) {
          retries++;
          console.log(`Retrying getUniquePrograms... (attempt ${retries + 1})`);
          pgPool = null;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Failed to fetch unique programs after retries');
  }

  static async getUniqueCategories(): Promise<{ category: string }[]> {
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        const pool = await getPostgresConnection();

        const query = `
          SELECT DISTINCT category
          FROM public.trainer_productivity
          WHERE category IS NOT NULL
            AND category <> ''
          ORDER BY category
        `;

        const result = await pool.query(query);
        return result.rows;
      } catch (error: any) {
        console.error(`Error fetching unique categories (attempt ${retries + 1}/${maxRetries + 1}):`, error);
        
        if (error.code === 'ECONNCLOSED' && retries < maxRetries) {
          retries++;
          console.log(`Retrying getUniqueCategories... (attempt ${retries + 1})`);
          pgPool = null;
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Failed to fetch unique categories after retries');
  }

  static async getTrainersEvents(year?: number, month?: number, page: number = 1, pageSize: number = 50, search?: string, trainers?: string[], programs?: string[], categories?: string[], sortBy: string = 'eventdate', sortOrder: string = 'desc') {
    let retries = 0;
    const maxRetries = 1;
    
    while (retries <= maxRetries) {
      try {
        const pool = await getPostgresConnection();
        
        const params: any[] = [];
        let paramIndex = 1;
        
        // Build WHERE conditions
        const conditions: string[] = [];
        
        if (year) {
          conditions.push(`year = $${paramIndex}`);
          params.push(year);
          paramIndex++;
        }
        
        if (month) {
          conditions.push(`month = $${paramIndex}`);
          params.push(month);
          paramIndex++;
        }
        
        if (search) {
          conditions.push(`(
            CAST(prodid AS TEXT) ILIKE $${paramIndex}
            OR prodname ILIKE $${paramIndex}
            OR country ILIKE $${paramIndex}
            OR trainer ILIKE $${paramIndex}
            OR program ILIKE $${paramIndex}
            OR category ILIKE $${paramIndex}
            OR location ILIKE $${paramIndex}
          )`);
          params.push(`%${search}%`);
          paramIndex++;
        }
        
        if (trainers && trainers.length > 0) {
          const trainerPlaceholders = trainers.map((_, i) => `$${paramIndex + i}`).join(', ');
          conditions.push(`trainer IN (${trainerPlaceholders})`);
          params.push(...trainers);
          paramIndex += trainers.length;
        }
        
        if (programs && programs.length > 0) {
          const programPlaceholders = programs.map((_, i) => `$${paramIndex + i}`).join(', ');
          conditions.push(`program IN (${programPlaceholders})`);
          params.push(...programs);
          paramIndex += programs.length;
        }
        
        if (categories && categories.length > 0) {
          const categoryPlaceholders = categories.map((_, i) => `$${paramIndex + i}`).join(', ');
          conditions.push(`category IN (${categoryPlaceholders})`);
          params.push(...categories);
          paramIndex += categories.length;
        }
        
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        
        // Sorting - validate column name to prevent SQL injection
        const validSortColumns = [
          'prodid', 'prodname', 'category', 'program', 'eventdate', 'productprice',
          'vendor', 'country', 'stockquantity', 'status_event', 'month', 'year',
          'trainer', 'cotrainer1', 'cotrainer2', 'cotrainer3', 'location',
          'totalrevenue', 'totaltickets'
        ];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'eventdate';
        const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        // Pagination
        const offset = (page - 1) * pageSize;
        const limitClause = `LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(pageSize, offset);

      const query = `
        SELECT 
          prodid,
          prodname,
          category,
          program,
          eventdate,
          productprice,
          vendor,
          country,
          stockquantity,
          status_event,
          month,
          year,
          repeaterprice,
          trainerlist,
          trainer,
          cotrainer1,
          cotrainer2,
          cotrainer3,
          cotrainer4,
          cotrainer5,
          trainercount,
          location,
          reportinggroup,
          split,
          trainerpercent,
          revenueaftercommission,
          (paidtickets + ticketsfree) as totaltickets,
          ticketsrepeater,
          ticketsfree,
          revenue,
          revenuerepeater,
          revenuecash,
          revenuepaypal,
          totalrevenue,
          paidtickets,
          ticketspaypal,
          ticketscash,
          hasrevenue,
          eventhasrev,
          isshared,
          trainernormalized,
          cotrainer1normalized,
          cotrainer2normalized,
          cotrainer3normalized,
          cotrainer4normalized,
          deletedticket,
          alejandropercent,
          trainercountry,
          cotrainer1country,
          cotrainer2country,
          cotrainer3country,
          cotrainer4country,
          feeale,
          eventtype,
          trainerhomecountry,
          cotrainer1homecountry,
          cotrainer2homecountry,
          cotrainer3homecountry,
          cotrainer4homecountry
        FROM public.trainer_productivity
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}, prodid DESC
        ${limitClause}
      `;

        const result = await pool.query(query, params);
        return result.rows;
        /* COMMENTED OUT - OLD MS SQL QUERY - TO BE REMOVED
            on p.id = oi.ProductId
            left join [Order] o WITH (NOLOCK)
            on oi.OrderId = o.id
            left join Product_Category_Mapping pcm WITH (NOLOCK)
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam WITH (NOLOCK)
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm WITH (NOLOCK)
            on p.id = scm.ProductId
            left join country cn WITH (NOLOCK)
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav WITH (NOLOCK)
            on pam.id = pav.ProductAttributeMappingId
            left join Category c WITH (NOLOCK)
            on pcm.CategoryId = c.id
            left join Vendor v WITH (NOLOCK)
            on p.VendorId = v.Id
            left join Customer cu WITH (NOLOCK)
            on o.CustomerId = cu.id
            left join customer_customerrole_mapping crm WITH (NOLOCK)
            on cu.id = crm.customer_id
            left join customerrole cr WITH (NOLOCK)
            on crm.customerrole_id = cr.id
            left join Product_SpecificationAttribute_Mapping psm WITH (NOLOCK)
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao WITH (NOLOCK)
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa WITH (NOLOCK)
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2 WITH (NOLOCK)
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 WITH (NOLOCK)
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 WITH (NOLOCK)
            on sao2.SpecificationAttributeId = sa2.Id
            left join SalsationSubscriber ss WITH (NOLOCK)
            on (oi.Id = ss.OrderItemId
            and cu.id = ss.CustomerId
            and p.id = ss.parentid
            and o.id = ss.orderid)
            left join TierPrice tp WITH (NOLOCK)
            on (p.id = tp.productId
            and oi.PriceInclTax = tp.price
            and oi.Quantity = tp.Quantity)
            where sa.id = 10
            and sa2.id = 6
            and o.orderstatusid = '30'
            and o.paymentstatusid in ('30','35')
            and (p.Published = 1
            or (p.id = '40963' and p.Published = 0))
            and p.id not in ('54958', '53000', '55053')
            ${year ? "AND pav.name like '%' + CAST(@year AS VARCHAR(4)) + '%'" : "AND (pav.name like '%2024%' or pav.name like '%2025%')"}
            ${month ? "AND MONTH(CAST(SUBSTRING(pav.Name, CHARINDEX(',', pav.Name) + 2, CHARINDEX('-', pav.Name) - CHARINDEX(',', pav.Name) - 3) AS DATE)) = @month" : ''}
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
            oi.PriceInclTax - o.RefundedAmount as PriceTotal,
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
            from product p WITH (NOLOCK)
            left join OrderItem oi WITH (NOLOCK)
            on p.id = oi.ProductId
            left join [Order] o WITH (NOLOCK)
            on oi.OrderId = o.id
            left join Product_Category_Mapping pcm WITH (NOLOCK)
            on p.id = pcm.ProductId
            left join Product_ProductAttribute_Mapping pam WITH (NOLOCK)
            on p.id = pam.ProductId
            left join SalsationEvent_Country_Mapping scm WITH (NOLOCK)
            on p.id = scm.ProductId
            left join country cn WITH (NOLOCK)
            on scm.CountryId = cn.Id
            left join ProductAttributeValue pav WITH (NOLOCK)
            on pam.id = pav.ProductAttributeMappingId
            left join Category c WITH (NOLOCK)
            on pcm.CategoryId = c.id
            left join Vendor v WITH (NOLOCK)
            on p.VendorId = v.Id
            left join Customer cu WITH (NOLOCK)
            on o.CustomerId = cu.id
            left join customer_customerrole_mapping crm WITH (NOLOCK)
            on cu.id = crm.customer_id
            left join customerrole cr WITH (NOLOCK)
            on crm.customerrole_id = cr.id
            left join Product_SpecificationAttribute_Mapping psm WITH (NOLOCK)
            on p.Id = psm.productid
            left join SpecificationAttributeOption sao WITH (NOLOCK)
            on psm.SpecificationAttributeOptionId = sao.Id 
            left join SpecificationAttribute sa WITH (NOLOCK)
            on sao.SpecificationAttributeId = sa.Id
            left join Product_SpecificationAttribute_Mapping psm2 WITH (NOLOCK)
            on p.Id = psm2.productid
            left join SpecificationAttributeOption sao2 WITH (NOLOCK)
            on psm2.SpecificationAttributeOptionId = sao2.Id 
            left join SpecificationAttribute sa2 WITH (NOLOCK)
            on sao2.SpecificationAttributeId = sa2.Id
            left join SalsationSubscriber ss WITH (NOLOCK)
            on (oi.Id = ss.OrderItemId
            and cu.id = ss.CustomerId
            and p.id = ss.parentid
            and o.id = ss.orderid)
            left join TierPrice tp WITH (NOLOCK)
            on (p.id = tp.productId
            and oi.PriceInclTax = tp.price
            and oi.Quantity = tp.Quantity)
            where sa.id = 10
            and sa2.id = 6
            and o.orderstatusid = '30'
            and o.paymentstatusid in ('30','35')
            and p.id in ('54958')
            and p.id not in ('53000', '55053')
            ${year ? "AND YEAR(o.PaidDateUtc) = @year" : "AND (o.PaidDateUtc like '%2024%' or o.PaidDateUtc like '%2025%')"}
            ${month ? "AND MONTH(o.PaidDateUtc) = @month" : ''}
            )
            , finals_order as (
            select
                *
                , row_number() over(partition by orderid, customerid, prodid order by eventdate asc) rn
            from base_order
            )
            , orderdataraw as (
            select 
            OrderID,
            DatePaid,
            EventDate,
            ProdID,
            ProdName,
            Category,
            Program,
            quantity,
            ProductPrice,
            UnitPrice,
            PriceTotal,
            TierLevel,
            Vendor,
            Country,
            CustomerID,
            Customer,
            PaymentMethod,
            Attendance,
            PaymentStatus,
            StockQuantity
            from finals_order
            where rn = 1
            )
            , base_eventdataraw AS (
                SELECT
                    ProdID,
                    ProdName,
                    case when prodid = 74191 then 'Seminar'
                        else Category
                    end as Category,
                    Program,
                    EventDate,
                    ProductPrice,
                    Vendor,
                    Country,
                    StockQuantity,
                    Status_Event,
                    FORMAT(CONVERT(DATE, EventDate, 103), 'MMMM') AS month,
                    YEAR(EventDate) AS year,
                    CASE
                        WHEN Category = 'Instructor Training' THEN 120
                        ELSE 0
                    END AS RepeaterPrice
                FROM EventDataRaw
            )
            , base_orderdataraw as (
            select
                *
                , CASE 
                    WHEN ProdID = 68513 THEN 'Cruise'
                    WHEN TierLevel = 'Repeater' THEN 'Repeater'
                    WHEN PaymentMethod = 'Free Ticket' THEN 'FreeTicket'
                    ELSE 'Regular'
                END as repeater
                , case
                    when Attendance = 'Unattended' and PaymentStatus = 35 then 1
                    else 0
                end as deleted
            from orderdataraw
            )
            , cotrainers as (
            select ParentId as ProdID, CustomerId, c.name
            from SALSATION_PP.dbo.SalsationSubscriber a WITH (NOLOCK)
            left join Customer b WITH (NOLOCK)
            on a.customerid = b.id
            left join vendor c WITH (NOLOCK)
            on b.VendorId = c.id
            where IsCoInstructor = 1
            )
            , finals_cotrainers as (
            select
                ProdID,
                STRING_AGG(name, ', ') AS cotrainers_name
            from cotrainers
            group by prodid
            )
            , ExtractedTrainers AS ( 
                SELECT
                    a.prodid,
                    a.prodname,
                    CONCAT(a.Vendor, ', ', b.cotrainers_name) AS TrainerList
                FROM base_eventdataraw a
                left join finals_cotrainers b
                on a.prodid = b.prodid
            ),
            CleanedTrainers AS (
            SELECT 
                prodid, 
                prodname, 
                TrainerList,
                LTRIM(RTRIM(Split.value('.', 'varchar(255)'))) AS SplitPart,
                ROW_NUMBER() OVER (PARTITION BY prodname ORDER BY (SELECT NULL)) AS PartNum
            FROM (
                SELECT 
                    prodid, 
                    prodname, 
                    TrainerList,
                    CAST('<X>' + REPLACE(REPLACE(REPLACE(TrainerList, ' & ', ','), ',', '</X><X>'), '&', '&amp;') + '</X>' AS XML) AS TrainersXML
                FROM ExtractedTrainers
                WHERE TrainerList IS NOT NULL
            ) AS t
            CROSS APPLY TrainersXML.nodes('/X') AS Trainers(Split)
            ),
            FinalSplit AS (
                SELECT 
                    prodid,
                    prodname,
                    TrainerList,
                    CASE PartNum 
                        WHEN 1 THEN TRIM(SplitPart)
                        ELSE NULL 
                    END as Trainer1,
                    CASE PartNum 
                        WHEN 2 THEN TRIM(SplitPart)
                        ELSE NULL 
                    END as CoTrainer1,
                    CASE PartNum 
                        WHEN 3 THEN TRIM(SplitPart)
                        ELSE NULL 
                    END as CoTrainer2,
                    CASE PartNum 
                        WHEN 4 THEN TRIM(SplitPart)
                        ELSE NULL 
                    END as CoTrainer3,
                    CASE PartNum 
                        WHEN 5 THEN TRIM(SplitPart)
                        ELSE NULL 
                    END as CoTrainer4,
                    CASE PartNum 
                        WHEN 6 THEN TRIM(SplitPart)
                        ELSE NULL 
                    END as CoTrainer5
                FROM CleanedTrainers
            )
            , data_trainers as (
            SELECT 
                prodid,
                prodname,
                TrainerList,
                MAX(Trainer1) as mainTrainer,
                case when MAX(CoTrainer1) = '' then NULL
                else MAX(CoTrainer1)
                end as CoTrainer1,
                case when MAX(CoTrainer2) = '' then NULL
                else MAX(CoTrainer2)
                end as CoTrainer2,
                case when MAX(CoTrainer3) = '' then NULL
                else MAX(CoTrainer3)
                end as CoTrainer3,
                case when MAX(CoTrainer4) = '' then NULL
                else MAX(CoTrainer4)
                end as CoTrainer4,
                case when MAX(CoTrainer5) = '' then NULL
                else MAX(CoTrainer5)
                end as CoTrainer5
            FROM FinalSplit
            GROUP BY prodid, prodname, TrainerList
            )
            , base2 as (
            select 
                a.*
                ,	b.TrainerList
                ,	b.mainTrainer
                ,	case
                        when b.TrainerList = 'Kami & Yoyo' then 'Kami/Yoyo'
                        when b.TrainerList = 'Kukizz & Javier' then 'Kukizz/Javier'
                        else b.mainTrainer
                    end as Trainer
                ,	case
                        when b.TrainerList = 'Kami & Yoyo' then NULL
                        when b.TrainerList = 'Kukizz & Javier' then NULL
                        else b.CoTrainer1
                    end as CoTrainer1
                ,	b.CoTrainer2
                ,	b.CoTrainer3
                ,	b.CoTrainer4
                ,	b.CoTrainer5
                ,  (CASE WHEN mainTrainer IS NOT NULL AND mainTrainer <> '' THEN 1 ELSE 0 END +
                    CASE WHEN case
                        when b.TrainerList = 'Kami & Yoyo' then NULL
                        when b.TrainerList = 'Kukizz & Javier' then NULL
                        else b.CoTrainer1
                    end IS NOT NULL AND case
                        when b.TrainerList = 'Kami & Yoyo' then NULL
                        when b.TrainerList = 'Kukizz & Javier' then NULL
                        else b.CoTrainer1
                    end <> '' THEN 1 ELSE 0 END +
                    CASE WHEN CoTrainer2 IS NOT NULL AND CoTrainer2 <> '' THEN 1 ELSE 0 END +
                    CASE WHEN CoTrainer3 IS NOT NULL AND CoTrainer3 <> '' THEN 1 ELSE 0 END +
                    CASE WHEN CoTrainer4 IS NOT NULL AND CoTrainer4 <> '' THEN 1 ELSE 0 END +
                    CASE WHEN CoTrainer5 IS NOT NULL AND CoTrainer5 <> '' THEN 1 ELSE 0 END
                    ) 
                AS TrainerCount
            , CASE 
                        WHEN a.ProdName LIKE '%Online%' and a.ProdName LIKE '%Global%' 
                        THEN 'OnlineGlobal'
                        WHEN a.ProdName LIKE '%Online%' or a.ProdName LIKE '%En Linea%' or  a.ProdName LIKE '%En Línea%'
                        THEN 'Online'
                        WHEN a.ProdName LIKE '%Venue,%'
                        THEN 'Venue'
                        WHEN a.ProdName LIKE '%Presencial%' 
                        THEN 'Venue'
                        WHEN a.ProdName LIKE 'ON DEMAND!%' 
                        THEN 'On Demand'
                        WHEN a.ProdName LIKE 'ISOLATION INSPIRATION Workshop%' or a.ProdName LIKE 'SALSATION Workshop with%'
                        THEN 'Venue'
                        when a.prodid = 68513
                        then 'Venue'
                        when a.ProdName like '%THE SALSATION BLAST%' or a.ProdName like '%SALSATION Method Training%'
                        then 'Venue'
                        ELSE NULL
                    END AS Location
            from base_eventdataraw a
            left join data_trainers b
            on
                a.prodid = b.prodid
            )
            , base3 as (
            select 
                *
                , CASE
                WHEN LEFT(ProdName, 7) = 'TROUPER' THEN 'Trouper Talk'
                WHEN lower(ProdName) like '%global%'  and category = 'Workshops' and program = 'Choreology'  THEN 'Choreology Workshops OnlineGlobal'
                ELSE CONCAT_WS(' ',
                    Program,
                    Category,
                    CASE
                        WHEN Category = 'Workshops' 
                            AND Trainer IN ('Alejandro', 'Alejandro Angulo') THEN NULL
                        WHEN Category IN ('Workshops', 'Seminar') THEN Location
                        ELSE NULL
                    END,
                    CASE 
                        WHEN Trainer IN ('Alejandro', 'Alejandro Angulo') THEN 'Alejandro'
                        ELSE NULL
                    END
                    )
                END AS ReportingGroup
            from base2
            )
            , param_reporting_grp as (
                SELECT 
                    'Choreology Instructor training' AS ReportingGroup, '30/70' AS Split, 0.30 AS TrainerPercent, 0.05 AS AlejandroPercent, 230 AS Price, 120 AS RepeaterPrice
                UNION ALL
                SELECT 'Choreology Workshops Online', '60/40', 0.70, 0.00, 40, NULL
                UNION ALL
                SELECT 'Choreology Workshops OnlineGlobal', '50/50', 0.50, 0.00, 40, NULL
                UNION ALL
                SELECT 'Choreology Workshops Venue', '70/30', 0.70, 0.00, 40, NULL
                UNION ALL
                SELECT 'Kid Instructor training', '35/65', 0.35, 0.10, 230, 120
                UNION ALL
                SELECT 'Kid Instructor training Alejandro', '35/65', 0.35, 0.00, 230, 120
                UNION ALL
                SELECT 'Rootz Instructor training', '30/70', 0.30, 0.05, 230, 120
                UNION ALL
                SELECT 'Rootz Workshops Venue', '70/30', 0.70, 0.00, 40, NULL
                UNION ALL
                SELECT 'Salsation Instructor training', '40/60', 0.40, 0.10, 230, 120
                UNION ALL
                SELECT 'Salsation Instructor training Alejandro', '40/60', 0.40, 0.00, 230, 120
                UNION ALL
                SELECT 'Salsation Method Training', '45/55', 0.45, 0.10, 230, 120
                UNION ALL
                SELECT 'Salsation Method Training Alejandro', '45/55', 0.45, 0.00, 230, 120
                UNION ALL
                SELECT 'Salsation On Demand', '50/50', 0.50, 0.00, 195, NULL
                UNION ALL
                SELECT 'Salsation On-Demand', '50/50', 0.50, 0.00, 195, NULL
                UNION ALL
                SELECT 'Salsation Salsation Blast Alejandro', '0/100', 0.00, 0.10, 60, NULL
                UNION ALL
                SELECT 'Salsation Seminar Alejandro', '70/30', 0.70, 0.00, 40, NULL
                UNION ALL
                SELECT 'Salsation Workshops Online', '50/50', 0.50, 0.00, 40, NULL
                UNION ALL
                SELECT 'Salsation Workshops OnlineGlobal', '50/50', 0.50, 0.00, 40, NULL
                UNION ALL
                SELECT 'Salsation Workshops Venue', '70/30', 0.70, 0.00, 40, NULL
                UNION ALL
                SELECT 'Salsation Seminar Venue', '70/30', 0.70, 0.00, 40, NULL
                UNION ALL
                SELECT 'Salsation Workshops Alejandro', '70/30', 0.70, 0.00, 40, NULL
                UNION ALL
                SELECT 'Trouper Talk', '0/100', 0.00, 0.00, 0, NULL
                UNION ALL
                SELECT 'Salsation Seminar OnlineGlobal', '50/50', 0.50, 0.00, NULL, NULL
                UNION ALL
                SELECT 'Salsation Join Event Alejandro', '50/50', 0.50, 0.00, 40, NULL
            )
            , TrainerParameters AS (
                SELECT 'Malaysia' AS Country, 'Addin Arif' AS Trainer, 'Addin' AS TrainerEventName, 'SET' AS Level, 'AddinMalaysia' AS HomeCountry
                UNION ALL SELECT 'Costa Rica', 'Adriana Villalobos', 'Adriana', 'SMT', 'AdrianaCosta Rica'
                UNION ALL SELECT 'Poland', 'Angelika Kiercul', 'Angelika', 'SMT', 'AngelikaPoland'
                UNION ALL SELECT 'Cananda', 'Angelika Kiercul', 'Angelika', 'SMT', 'AngelikaCananda'
                UNION ALL SELECT 'Spain', 'Chaxiraxi Rodriguez', 'Chaxi', 'SET', 'ChaxiSpain'
                UNION ALL SELECT 'Korea', 'Cindy(dongok Shin)', 'Cindy', 'SET', 'CindyKorea'
                UNION ALL SELECT 'Germany', 'Claudia Thiele', 'Claudia', 'SET', 'ClaudiaGermany'
                UNION ALL SELECT 'Chile', 'Cris Huenchumil', 'Cris', 'SET', 'CrisChile'
                UNION ALL SELECT 'Austria', 'Diana Kukizz', 'Kukizz/Javier', 'SMT', 'Kukizz/JavierAustria'
                UNION ALL SELECT 'Slovakia (Slovak Republic)', 'Diana Kukizz', 'Kukizz/Javier', 'SMT', 'Kukizz/JavierSlovakia (Slovak Republic)'
                UNION ALL SELECT 'Switzerland', 'Diana Kukizz', 'Kukizz/Javier', 'SMT', 'Kukizz/JavierSwitzerland'
                UNION ALL SELECT 'Malaysia', 'Eka Yahya', 'Eka', 'SET', 'EkaMalaysia'
                UNION ALL SELECT 'Italy', 'Federica Boriani', 'Federica', 'SMT', 'FedericaItaly'
                UNION ALL SELECT 'Germany', 'Federica Boriani', 'Federica', 'SMT', 'FedericaGermany'
                UNION ALL SELECT 'Poland', 'Gosia Izydorczyk', 'Gosia', 'SMT', 'GosiaPoland'
                UNION ALL SELECT 'Slovenia', 'Irena Pfundner', 'Irena', 'SMT', 'IrenaSlovenia'
                UNION ALL SELECT 'Mexico', 'Irving Herrera', 'Irving', 'SMT', 'IrvingMexico'
                UNION ALL SELECT 'Austria', 'Javier Calderon', 'Kukizz/Javier', 'SMT', 'Kukizz/JavierAustria'
                UNION ALL SELECT 'Costa Rica', 'Javier Calderon', 'Kukizz/Javier', 'SMT', 'Kukizz/JavierCosta Rica'
                UNION ALL SELECT 'Switzerland', 'Javier Calderon', 'Kukizz/Javier', 'SMT', 'Kukizz/JavierSwitzerland'
                UNION ALL SELECT 'Russian Federation', 'Julia Trotskaya', 'Julia', 'SMT', 'JuliaRussian Federation'
                UNION ALL SELECT 'Korea', 'Kamila Wierzyńska', 'Kami/Yoyo', 'SMT', 'Kami/YoyoKorea'
                UNION ALL SELECT 'Thailand', 'Kamila Wierzyńska', 'Kami/Yoyo', 'SMT', 'Kami/YoyoThailand'
                UNION ALL SELECT 'Croatia', 'Katia Mello', 'Katia', 'SMT', 'KatiaCroatia'
                UNION ALL SELECT 'Italy', 'Kevin Castillo', 'Kevin C', 'SET', 'Kevin CItaly'
                UNION ALL SELECT 'Chile', 'Kevin Oyola de la Fuente', 'Kevin O', 'SMT', 'Kevin OChile'
                UNION ALL SELECT 'Spain', 'Maga Contreras', 'Maga', 'SMT', 'MagaSpain'
                UNION ALL SELECT 'Portugal', 'Manuel Goiana', 'Manuel', 'SMT', 'ManuelPortugal'
                UNION ALL SELECT 'Malaysia', 'Muzry Yussof', 'Muzry', 'SMT', 'MuzryMalaysia'
                UNION ALL SELECT 'Norway', 'Nanna Jelbert', 'Nanna', 'SMT', 'NannaNorway'
                UNION ALL SELECT 'Sweden', 'Nanna Jelbert', 'Nanna', 'SMT', 'NannaSweden'
                UNION ALL SELECT 'Finland', 'Nanna Jelbert', 'Nanna', 'SMT', 'NannaFinland'
                UNION ALL SELECT 'Denmark', 'Nanna Jelbert', 'Nanna', 'SMT', 'NannaDenmark'
                UNION ALL SELECT 'Indonesia', 'Natasha Bakhmat', 'Natasha', 'SMT', 'NatashaIndonesia'
                UNION ALL SELECT 'Poland', 'Nicola Egwuatu', 'Nicola', 'SET', 'NicolaPoland'
                UNION ALL SELECT 'Poland', 'Ola Michalska', 'Ola', 'SET', 'OlaPoland'
                UNION ALL SELECT 'Spain', 'Pipo Franco', 'Pipo', 'SET', 'PipoSpain'
                UNION ALL SELECT 'Poland', 'Primo Waszczyszyn', 'Primo', 'SMT', 'PrimoPoland'
                UNION ALL SELECT 'Malaysia', 'Ramizah Kamis', 'Ramizah', 'SET', 'RamizahMalaysia'
                UNION ALL SELECT 'Portugal', 'Rita Areosa', 'Rita', 'SMT', 'RitaPortugal'
                UNION ALL SELECT 'Germany', 'Ronald Morales Dubes', 'Ronald', 'SMT', 'RonaldGermany'
                UNION ALL SELECT 'Spain', 'Roxana Rodríguez', 'Roxana', 'SMT', 'RoxanaSpain'
                UNION ALL SELECT 'Qatar', 'Rumz Dominic', 'Rumz', 'SMT', 'RumzQatar'
                UNION ALL SELECT 'Indonesia', 'Sari Unen', 'Sari', 'SMT', 'SariIndonesia'
                UNION ALL SELECT 'Mexico', 'Sergio Viñas', 'Sergio', 'SET', 'SergioMexico'
                UNION ALL SELECT 'Hungary', 'Tamás Marx', 'Tamas', 'SMT', 'TamasHungary'
                UNION ALL SELECT 'Slovenia', 'Viktorija Manzinni', 'Viktorija', 'SET', 'ViktorijaSlovenia'
                UNION ALL SELECT 'Montenegro', 'Viktorija Manzinni', 'Viktorija', 'SET', 'ViktorijaMontenegro'
                UNION ALL SELECT 'Serbia', 'Viktorija Manzinni', 'Viktorija', 'SET', 'ViktorijaSerbia'
                UNION ALL SELECT 'Cost Rica', 'Viviana Quesada', 'Vivian', 'SET', 'VivianCost Rica'
                UNION ALL SELECT 'Germany', 'Vladimir Gerónimo', 'Vladimir', 'SMT', 'VladimirGermany'
                UNION ALL SELECT 'Guatemala', 'Will Sanchez', 'Will', 'SMT', 'WillGuatemala'
                UNION ALL SELECT 'France', 'Will Sanchez', 'Will', 'SMT', 'WillFrance'
                UNION ALL SELECT 'Korea', 'Yoandro Ulloa', 'Kami/Yoyo', 'SMT', 'Kami/YoyoKorea'
                UNION ALL SELECT 'Malaysia', 'Yoyo Sanchez', 'Yoyo', 'SMT', 'YoyoMalaysia'
                UNION ALL SELECT 'Japan', 'Grace Casalino', 'Grace', 'SMT', 'GraceJapan'
                UNION ALL SELECT 'Indonesia', 'Alejandro Angulo', 'Alejandro', 'FOUNDER', 'AlejandroIndonesia'
                UNION ALL SELECT 'Malta', 'Luis Jose Villarroel Hernandez', 'Luis', 'SMT', 'LuisMalta'
                UNION ALL SELECT 'Germany', 'Lea Hataj', 'Lea', 'SET', 'LeaGermany'
                UNION ALL SELECT 'France', 'Eka Yahya', 'Eka', 'SET', 'EkaFrance'
                UNION ALL SELECT 'Japan', 'Tommy Miyako Tomikawa', 'Tommy', 'SET', 'TommyJapan'
                UNION ALL SELECT 'Japan', 'Hiromi Meguro', 'Hiromi', 'SET', 'HiromiJapan'
                UNION ALL SELECT 'Portugal', 'Ines Silva', 'Ines', 'SET', 'InesPortugal'
                UNION ALL SELECT 'Japan', 'Julie Okuda', 'Julie', 'SET', 'JulieJapan'
                UNION ALL SELECT 'Denmark', 'Sofie Olsen', 'Sofie', 'SET', 'SofieJapan'
                UNION ALL SELECT 'Sweden', 'Mikaela Bostrom', 'Mikaela', 'SET', 'MikaelaJapan'
            )
            , finals_1 as (
            select 
                a.ProdID,
                a.ProdName,
                a.Category,
                a.Program,
                a.EventDate,
                a.ProductPrice,
                a.Vendor,
                a.Country,
                a.StockQuantity,
                a.Status_Event,
                a.[month],
                a.[year],
                a.RepeaterPrice,
                a.TrainerList,
                a.Trainer,
                a.CoTrainer1,
                a.CoTrainer2,
                a.CoTrainer3,
                a.CoTrainer4,
                a.CoTrainer5,
                a.TrainerCount,
                a.Location,
                a.ReportingGroup,
                b.Split,
                floor(sum(b.TrainerPercent + b.AlejandroPercent)) as TrainerPercent,
                (SUM(CASE WHEN repeater = 'Regular' AND Deleted = 0 THEN PriceTotal ELSE 0 END)
                - (b.TrainerPercent * SUM(CASE WHEN repeater = 'Regular' AND Deleted = 0 THEN PriceTotal ELSE 0 END)))
                AS revenueAfterCommission,
                SUM(CASE WHEN repeater IN ('Regular', 'Cruise') THEN 1 ELSE 0 END) - SUM(CASE WHEN repeater IN ('Regular', 'Cruise') AND Deleted = 1 THEN 1 ELSE 0 END) as tickets,
                SUM(CASE WHEN repeater IN ('Repeater') THEN 1 ELSE 0 END) - SUM(CASE WHEN repeater IN ('Repeater') AND Deleted = 1 THEN 1 ELSE 0 END) as ticketsRepeater,
                SUM(CASE WHEN repeater IN ('FreeTicket') THEN 1 ELSE 0 END) - SUM(CASE WHEN repeater IN ('FreeTicket') AND Deleted = 1 THEN 1 ELSE 0 END) as ticketsFree,
                SUM(CASE WHEN repeater IN ('Regular') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN repeater IN ('Regular') AND Deleted = 1 THEN PriceTotal ELSE 0 END) as revenue,
                SUM(CASE WHEN repeater IN ('Repeater') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN repeater IN ('Repeater') AND Deleted = 1 THEN PriceTotal ELSE 0 END) as revenueRepeater,
                SUM(CASE WHEN PaymentMethod IN ('Cash') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN PaymentMethod IN ('Cash') AND Deleted = 1 THEN PriceTotal ELSE 0 END) as revenueCash,
                SUM(CASE WHEN PaymentMethod IN ('Paypal') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN PaymentMethod IN ('Paypal') AND Deleted = 1 THEN PriceTotal ELSE 0 END) as revenuePaypal,
                (SUM(CASE WHEN PaymentMethod IN ('Cash') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN PaymentMethod IN ('Cash') AND Deleted = 1 THEN PriceTotal ELSE 0 END) + SUM(CASE WHEN PaymentMethod IN ('Paypal') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN PaymentMethod IN ('Paypal') AND Deleted = 1 THEN PriceTotal ELSE 0 END)) totalRevenue,
                (SUM(CASE WHEN repeater IN ('Regular', 'Cruise') THEN 1 ELSE 0 END) - SUM(CASE WHEN repeater IN ('Regular', 'Cruise') AND Deleted = 1 THEN 1 ELSE 0 END)) + (SUM(CASE WHEN repeater IN ('Repeater') THEN 1 ELSE 0 END) - SUM(CASE WHEN repeater IN ('Repeater') AND Deleted = 1 THEN 1 ELSE 0 END)) as PaidTickets,
                COALESCE(
                    SUM(CASE WHEN PaymentMethod = 'Paypal' THEN 1 ELSE 0 END)
                    -
                    SUM(CASE WHEN PaymentMethod = 'Paypal' AND Deleted = 1 THEN 1 ELSE 0 END),
                0) AS ticketsPaypal,	
                COALESCE(
                    SUM(CASE WHEN PaymentMethod = 'Cash' THEN 1 ELSE 0 END)
                    -
                    SUM(CASE WHEN PaymentMethod = 'Cash' AND Deleted = 1 THEN 1 ELSE 0 END),
                0) AS ticketsCash,
                case
                    when (SUM(CASE WHEN PaymentMethod IN ('Cash') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN PaymentMethod IN ('Cash') AND Deleted = 1 THEN PriceTotal ELSE 0 END) + SUM(CASE WHEN PaymentMethod IN ('Paypal') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN PaymentMethod IN ('Paypal') AND Deleted = 1 THEN PriceTotal ELSE 0 END)) > 0 then 'YES'
                    else 'NO'
                end as hasRevenue,
                case
                    when (SUM(CASE WHEN PaymentMethod IN ('Cash') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN PaymentMethod IN ('Cash') AND Deleted = 1 THEN PriceTotal ELSE 0 END) + SUM(CASE WHEN PaymentMethod IN ('Paypal') THEN PriceTotal ELSE 0 END) - SUM(CASE WHEN PaymentMethod IN ('Paypal') AND Deleted = 1 THEN PriceTotal ELSE 0 END)) > 0 then 1
                    else 0
                end as eventHasRev,
                case
                    when TrainerCount > 1 then 'Shared'
                    else 'Not Shared'
                end as 'isShared',
                CASE 
                    WHEN Trainer = 'Kamila Wierzynska' THEN 'Kami/Yoyo'
                    WHEN Trainer = 'Yoandro' THEN 'Kami/Yoyo'
                    WHEN Trainer = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN Trainer = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN Trainer = 'Javier' THEN 'Kukizz/Javier'
                    ELSE LEFT(Trainer, CHARINDEX(' ', Trainer + ' ') - 1)
                END AS TrainerNormalized,
                CASE 
                    WHEN CoTrainer1 = 'Kamila Wierzynska' THEN 'Kami/Yoyo'
                    WHEN CoTrainer1 = 'Yoandro' THEN 'Kami/Yoyo'
                    WHEN CoTrainer1 = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN CoTrainer1 = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN CoTrainer1 = 'Javier' THEN 'Kukizz/Javier'
                    ELSE LEFT(CoTrainer1, CHARINDEX(' ', CoTrainer1 + ' ') - 1)
                END AS CoTrainer1Normalized,
                CASE 
                    WHEN CoTrainer2 = 'Kamila Wierzynska' THEN 'Kami/Yoyo'
                    WHEN CoTrainer2 = 'Yoandro' THEN 'Kami/Yoyo'
                    WHEN CoTrainer2 = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN CoTrainer2 = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN CoTrainer2 = 'Javier' THEN 'Kukizz/Javier'
                    ELSE LEFT(CoTrainer2, CHARINDEX(' ', CoTrainer2 + ' ') - 1)
                END AS CoTrainer2Normalized,
                CASE 
                    WHEN CoTrainer3 = 'Kamila Wierzynska' THEN 'Kami/Yoyo'
                    WHEN CoTrainer3 = 'Yoandro' THEN 'Kami/Yoyo'
                    WHEN CoTrainer3 = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN CoTrainer3 = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN CoTrainer3 = 'Javier' THEN 'Kukizz/Javier'
                    ELSE LEFT(CoTrainer3, CHARINDEX(' ', CoTrainer2 + ' ') - 1)
                END AS CoTrainer3Normalized,
                CASE 
                    WHEN CoTrainer4 = 'Kamila Wierzynska' THEN 'Kami/Yoyo'
                    WHEN CoTrainer4 = 'Yoandro' THEN 'Kami/Yoyo'
                    WHEN CoTrainer4 = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN CoTrainer4 = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                    WHEN CoTrainer4 = 'Javier' THEN 'Kukizz/Javier'
                    ELSE LEFT(CoTrainer4, CHARINDEX(' ', CoTrainer2 + ' ') - 1)
                END AS CoTrainer4Normalized,
                SUM(CASE WHEN deleted = 1 THEN 1 ELSE 0 END) as deletedTicket,
                CASE 
                    WHEN 
                        CASE 
                            WHEN Trainer = 'Kamila Wierzynska' THEN 'Kami/Yoyo'
                            WHEN Trainer = 'Yoandro' THEN 'Kami/Yoyo'
                            WHEN Trainer = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                            WHEN Trainer = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                            WHEN Trainer = 'Javier' THEN 'Kukizz/Javier'
                            ELSE Trainer
                        END = 'Alejandro Angulo' THEN 0 
                    ELSE b.AlejandroPercent 
                END AS AlejandroPercent
            from base3 a
            left join param_reporting_grp b
            on a.ReportingGroup = b.ReportingGroup
            left join base_orderdataraw d
            on a.prodid = d.prodid
            group by a.ProdID,
                a.ProdName,
                a.Category,
                a.Program,
                a.EventDate,
                a.ProductPrice,
                a.Vendor,
                a.Country,
                a.StockQuantity,
                a.Status_Event,
                a.[month],
                a.[year],
                a.RepeaterPrice,
                a.TrainerList,
                a.Trainer,
                a.CoTrainer1,
                b.TrainerPercent,
                a.CoTrainer2,
                a.CoTrainer3,
                a.CoTrainer4,
                a.CoTrainer5,
                a.TrainerCount,
                a.Location,
                a.ReportingGroup,
                b.Split,
                CASE 
                    WHEN 
                        CASE 
                            WHEN Trainer = 'Kamila Wierzynska' THEN 'Kami/Yoyo'
                            WHEN Trainer = 'Yoandro' THEN 'Kami/Yoyo'
                            WHEN Trainer = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                            WHEN Trainer = 'Diana Kukizz Kurucová' THEN 'Kukizz/Javier'
                            WHEN Trainer = 'Javier' THEN 'Kukizz/Javier'
                            ELSE Trainer
                        END = 'Alejandro Angulo' THEN 0 
                    ELSE b.AlejandroPercent 
                END
            )
            , finals_2 as (
            select
                a. *
                , concat(a.trainernormalized, a.country) as TrainerCountry
                , case
                    when a.cotrainer1normalized is not null then concat(a.cotrainer1normalized, a.country)
                    else null
                end as CoTrainer1Country
                , case
                    when a.cotrainer2normalized is not null then concat(a.cotrainer2normalized, a.country)
                    else null
                end as CoTrainer2Country
                , case
                    when a.cotrainer3normalized is not null then concat(a.cotrainer3normalized, a.country)
                    else null
                end as CoTrainer3Country
                , case
                    when a.cotrainer4normalized is not null then concat(a.cotrainer4normalized, a.country)
                    else null
                end as CoTrainer4Country
                , TotalRevenue * AlejandroPercent as FeeAle
            from finals_1 a
            )
            , final_new_1 as (
            select
                a.*
                , case 
                    when a.ReportingGroup = 'Choreology Instructor training' then 'Trainings'
                    when a.ReportingGroup = 'Choreology Workshops Online' then 'Workshops'
                    when a.ReportingGroup = 'Choreology Workshops OnlineGlobal' then 'Workshops'
                    when a.ReportingGroup = 'Choreology Workshops Venue' then 'Workshops'
                    when a.ReportingGroup = 'Kid Instructor training' then 'Trainings'
                    when a.ReportingGroup = 'Kid Instructor training Alejandro' then 'Trainings'
                    when a.ReportingGroup = 'Rootz Instructor training' then 'Trainings'
                    when a.ReportingGroup = 'Rootz Workshops Venue' then 'Workshops'
                    when a.ReportingGroup = 'Salsation Instructor training' then 'Trainings'
                    when a.ReportingGroup = 'Salsation Instructor training Alejandro' then 'Trainings'
                    when a.ReportingGroup = 'Salsation Method Training' then 'Trainings'
                    when a.ReportingGroup = 'Salsation Method Training Alejandro' then 'Trainings'
                    when a.ReportingGroup = 'Salsation On Demand' then 'Workshops'
                    when a.ReportingGroup = 'Salsation On-Demand' then 'Workshops'
                    when a.ReportingGroup = 'Salsation Salsation Blast Alejandro' then 'Workshops'
                    when a.ReportingGroup = 'Salsation Seminar Alejandro' then 'Seminars'
                    when a.ReportingGroup = 'Salsation Workshops Online' then 'Workshops'
                    when a.ReportingGroup = 'Salsation Workshops OnlineGlobal' then 'Workshops'
                    when a.ReportingGroup = 'Salsation Workshops Venue' then 'Workshops'
                    when a.ReportingGroup = 'Salsation Seminar Venue' then 'Seminars'
                    when a.ReportingGroup = 'Salsation Workshops Alejandro' then 'Workshops'
                    when a.ReportingGroup = 'Trouper Talk' then 'Trouper Talk'
                    when a.ReportingGroup = 'Salsation Seminar OnlineGlobal' then 'Seminars'
                    when a.ReportingGroup = 'Salsation Join Event Alejandro' then 'Workshops'
                    else null
                end as EventType
                , case
                    when b.HomeCountry is not null then 1
                    else null
                end as TrainerHomeCountry
                , case
                    when c.HomeCountry is not null then 1
                    else null
                end as CoTrainer1HomeCountry
                , case
                    when d.HomeCountry is not null then 1
                    else null
                end as CoTrainer2HomeCountry
                , case
                    when e.HomeCountry is not null then 1
                    else null
                end as CoTrainer3HomeCountry
        */ // END COMMENTED OUT OLD MS SQL QUERY
      } catch (error: any) {
        console.error(`Error fetching trainers events (attempt ${retries + 1}/${maxRetries + 1}):`, error);
        
        if ((error.code === 'ECONNCLOSED' || error.code === 'ETIMEOUT') && retries < maxRetries) {
          retries++;
          console.log(`Retrying getTrainersEvents... (attempt ${retries + 1})`);
          // Reset the pool to force reconnection
          pgPool = null;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error('Failed to fetch trainers events after retries');
  }
}
