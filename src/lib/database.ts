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
            AND EventDate >= DATEADD(MONTH, -2, GETDATE())
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
      , final_1 as (
        select 
            OrderID, DatePaid, EventDate, ProdID, ProdName, Category, Program,
            quantity, ProductPrice, UnitPrice, PriceTotal, TierLevel, Vendor, Country,
            CustomerID, Customer, PaymentMethod, Attendance, PaymentStatus, StockQuantity,
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
        from finals
        where rn = 1
      )
      select *
            , concat(Program, '-', Category, '-', Location, '-', Attendance) as ConcatTrainerPercentKey
            , case
                when TrainerName like '%Grace%' and Country = 'Japan' then concat(Program, '-', Category, '-', TierLevel)
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

    // Group orders by key characteristics and calculate trainer fees using SQLite
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
      // Get the trainer fee percentage from SQLite using the concat key
      const feePercent = this.getTrainerFeePercent(group.ConcatTrainerPercentKey);

      let unitPrice = group.UnitPrice;
      let priceTotal = group.UnitPrice * group.Quantity;

      // Apply Grace Price Conversion if trainer is Grace and country is Japan
      const rawTrainerName = eventRow.TrainerName || eventRow.Vendor || '';
      const isGraceTrainer = rawTrainerName.toLowerCase().includes('grace');
      const isJapan =
        eventRow.Country?.toLowerCase().includes('japan') ||
        eventRow.Country?.toLowerCase().includes('jp');

      if (isGraceTrainer && isJapan && group.TierLevel) {
        try {
          // Extract program and category from the event name
          const { program, category } = this.extractProgramAndCategory(eventRow.ProdName || '');
          const tierLevel = group.TierLevel;

          console.log(`Grace conversion: ${program}-${category}-${tierLevel} for EUR ${unitPrice}`);

          // Convert EUR to JPY
          const jpyAmount = await this.convertEurToJpy(unitPrice, program, category, tierLevel);
          if (jpyAmount !== null) {
            unitPrice = jpyAmount;
            priceTotal = jpyAmount * group.Quantity;
            console.log(`Converted to JPY: ${jpyAmount}`);
          } else {
            console.log('No conversion found for this tier level');
          }
        } catch (error) {
          console.error('Error applying Grace price conversion:', error);
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
        Currency: isGraceTrainer && isJapan ? 'JPY' : 'EUR', // Set currency based on conversion
      });
    }

    // Determine if this is a Grace event in Japan for currency display
    const rawTrainerName = eventRow.TrainerName || eventRow.Vendor || 'Unknown';
    const cleanedTrainerName = this.cleanTrainerName(rawTrainerName);
    const isGraceTrainer = rawTrainerName.toLowerCase().includes('grace');
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
      Currency: isGraceTrainer && isJapan ? 'JPY' : 'EUR', // Set event currency
      tickets,
    };

    return event;
  }

  static async getTrainerSplits(prodId: number): Promise<TrainerSplit[]> {
    try {
      // Use SQLite for trainer splits (app-specific data)
      const { TrainerSplitService } = require('./sqlite');
      const rows = TrainerSplitService.getByProdId(prodId);

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
      console.error('Error getting trainer splits from SQLite:', error);
      return [];
    }
  }

  static async saveTrainerSplit(split: TrainerSplit): Promise<void> {
    try {
      // Use SQLite for trainer splits (app-specific data)
      const { TrainerSplitService } = require('./sqlite');
      TrainerSplitService.upsert({
        prod_id: split.ProdID,
        row_id: split.RowId,
        name: split.Name,
        percent: split.Percent,
        trainer_fee: split.TrainerFee || 0,
        cash_received: split.CashReceived,
      });
    } catch (error) {
      console.error('Error saving trainer split to SQLite:', error);
      throw error;
    }
  }

  static async deleteTrainerSplit(prodId: number, rowId: number): Promise<void> {
    try {
      // Use SQLite for trainer splits (app-specific data)
      const { TrainerSplitService } = require('./sqlite');
      TrainerSplitService.delete(prodId, rowId);
    } catch (error) {
      console.error('Error deleting trainer split from SQLite:', error);
      throw error;
    }
  }

  static async getEventExpenses(prodId: number): Promise<any[]> {
    try {
      // Use SQLite for expenses (app-specific data)
      const { ExpenseService } = require('./sqlite');
      const rows = ExpenseService.getByProdId(prodId);

      return rows.map((row: any, index: number): any => ({
        id: index + 1,
        ProdID: row.prod_id,
        RowId: row.row_id,
        Description: row.description,
        Amount: row.amount,
      }));
    } catch (error: any) {
      console.error('Error getting expenses from SQLite:', error);
      return [];
    }
  }

  static async saveEventExpense(expense: any): Promise<void> {
    try {
      // Use SQLite for expenses (app-specific data)
      const { ExpenseService } = require('./sqlite');
      ExpenseService.upsert({
        prod_id: expense.ProdID,
        row_id: expense.RowId,
        description: expense.Description,
        amount: expense.Amount,
      });
    } catch (error) {
      console.error('Error saving expense to SQLite:', error);
      throw error;
    }
  }

  static async deleteEventExpense(prodId: number, rowId: number): Promise<void> {
    try {
      // Use SQLite for expenses (app-specific data)
      const { ExpenseService } = require('./sqlite');
      ExpenseService.delete(prodId, rowId);
    } catch (error) {
      console.error('Error deleting expense from SQLite:', error);
      throw error;
    }
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

  static async logAuditEvent(
    userId: string,
    action: string,
    prodId: number,
    details: string
  ): Promise<void> {
    try {
      // Use SQLite for audit logging (app-specific data)
      const { AuditService } = require('./sqlite');
      AuditService.log(userId, action, prodId, details);
    } catch (error) {
      console.error('Failed to log audit event to SQLite:', error);
      // Don't throw error for audit logging failures
    }
  }

  static async getGracePriceConversion(
    program: string,
    category: string,
    tierLevel: string
  ): Promise<{ jpyPrice: number; eurPrice: number } | null> {
    try {
      const { GracePriceService } = require('./sqlite');
      const eventTypeKey = `${program}-${category}-${tierLevel === 'Free' ? '' : tierLevel}`;

      const conversions = GracePriceService.getAll();
      const conversion = conversions.find((c: any) => c.eventTypeKey === eventTypeKey);

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
    tierLevel: string
  ): Promise<number | null> {
    return new Promise(async (resolve) => {
      try {
        const conversion = await this.getGracePriceConversion(program, category, tierLevel);
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
}
