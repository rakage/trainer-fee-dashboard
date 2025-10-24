import sql from 'mssql';
import { getConnection } from './database';

/**
 * Get summary totals for Trainers Events cards
 * This runs the FULL complex query (all 20+ CTEs) but returns only aggregated totals
 * Filtered by year/month only (no pagination)
 */
export async function getTrainersEventsSummary(year?: number, month?: number) {
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

    // Run the FULL query and aggregate at the end
    const query = `
      -- Aggregate wrapper around your full query
      SELECT 
        COUNT(DISTINCT prodid) as totalEvents,
        COUNT(DISTINCT trainer) as uniqueTrainers,
        ISNULL(SUM(totaltickets), 0) as totalTickets,
        ISNULL(SUM(totalrevenue), 0) as totalRevenue
      FROM (
        -- YOUR FULL ORIGINAL QUERY (without pagination)
        with base as (
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
          on a.prodid = b.prodid
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
            a.*
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
            , case
              when f.HomeCountry is not null then 1
              else null
            end as CoTrainer4HomeCountry
          from finals_2 a
          left join TrainerParameters b
          on a.TrainerCountry = b.HomeCountry
          left join TrainerParameters c
          on a.CoTrainer1Country = c.HomeCountry
          left join TrainerParameters d
          on a.CoTrainer2Country = d.HomeCountry
          left join TrainerParameters e
          on a.CoTrainer3Country = e.HomeCountry
          left join TrainerParameters f
          on a.CoTrainer4Country = f.HomeCountry
        )
        select
          prodid
          , prodname
          , category
          , program
          , eventdate
          , productprice
          , country
          , location
          , status_event
          , trainer
          , cotrainer1
          , cotrainer2
          , cotrainer3
          , totalrevenue
          , ticketsfree + paidtickets + ticketsRepeater as totaltickets
        from final_new_1
      ) as AllEvents
      OPTION (MAXDOP 4, OPTIMIZE FOR UNKNOWN)
    `;

    const result = await request.query(query);
    return result.recordset[0];
  } catch (error) {
    console.error('Error fetching trainers events summary:', error);
    throw error;
  }
}
