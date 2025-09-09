import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database';
import { requireRole } from '@/lib/middleware';

// Sample data from the specification
const sampleEvent = {
  ProdID: 77619,
  ProdName: 'SALSATION Workshop with Will, Venue, Hannover - Germany, 30 August 2025',
  EventDate: '2025-08-30',
  Country: 'Germany',
  Venue: 'Venue',
  Trainer_1: 'Will'
};

const sampleTickets = [
  { Attendance: 'Attended', PaymentMethod: 'Paypal', TierLevel: 'Early Bird', PriceTotal: 50.00, TrainerFeePct: 0.7, Quantity: 48 },
  { Attendance: 'Attended', PaymentMethod: 'Paypal', TierLevel: 'Regular', PriceTotal: 65.00, TrainerFeePct: 0.7, Quantity: 2 },
  { Attendance: 'Attended', PaymentMethod: 'Paypal', TierLevel: 'Troupe', PriceTotal: 40.00, TrainerFeePct: 0.7, Quantity: 28 },
  { Attendance: 'Attended', PaymentMethod: 'Paypal', TierLevel: 'Rush', PriceTotal: 80.00, TrainerFeePct: 0.7, Quantity: 2 },
  { Attendance: 'Free Ticket', PaymentMethod: null, TierLevel: null, PriceTotal: 0.00, TrainerFeePct: 0.7, Quantity: 1 },
  // Add some additional variety for testing
  { Attendance: 'Attended', PaymentMethod: 'Cash', TierLevel: 'Early Bird', PriceTotal: 50.00, TrainerFeePct: 0.7, Quantity: 5 },
  { Attendance: 'Attended', PaymentMethod: 'Cash', TierLevel: 'Regular', PriceTotal: 65.00, TrainerFeePct: 0.7, Quantity: 3 },
  { Attendance: 'No Show', PaymentMethod: 'Paypal', TierLevel: 'Early Bird', PriceTotal: 50.00, TrainerFeePct: 0.7, Quantity: 2 },
];

// Additional sample events for testing
const additionalEvents = [
  {
    ProdID: 77620,
    ProdName: 'SALSATION Masterclass with Sarah, Berlin - Germany, 15 September 2025',
    EventDate: '2025-09-15',
    Country: 'Germany',
    Venue: 'Dance Studio Berlin',
    Trainer_1: 'Sarah'
  },
  {
    ProdID: 77621,
    ProdName: 'SALSATION Intensive with Mike, Vienna - Austria, 22 October 2025',
    EventDate: '2025-10-22',
    Country: 'Austria',
    Venue: 'Vienna Dance Center',
    Trainer_1: 'Mike'
  }
];

export async function POST(request: NextRequest) {
  // Only allow seeding in development or for admin users
  if (process.env.NODE_ENV === 'production') {
    const authResult = await requireRole(request, ['admin']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
  }

  try {
    console.log('Connecting to real database...');
    
    const pool = await getConnection();
    
    // Test the connection by trying to get some events
    const testQuery = await pool.request().query(`
      SELECT TOP 5 
        p.id as ProdID, 
        p.name as ProdName
      FROM product p
      WHERE p.Published = 1
    `);
    
    console.log('Found', testQuery.recordset.length, 'sample events in database');
    
    // Create trainer splits table if it doesn't exist (for our app-specific data)
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EventTrainerSplits' AND xtype='U')
      CREATE TABLE dbo.EventTrainerSplits (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          ProdID INT,
          RowId INT,
          Name NVARCHAR(200),
          Percent DECIMAL(5,2),
          CashReceived MONEY,
          CreatedAt DATETIME2,
          UpdatedAt DATETIME2
      );
    `);

    // Get some real events count for statistics
    const statsQuery = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM product WHERE Published = 1) as TotalProducts,
        (SELECT COUNT(*) FROM dbo.EventTrainerSplits) as ExistingSplits
    `);

    const stats = statsQuery.recordset[0];
    
    return NextResponse.json({
      success: true,
      message: 'Connected to real database successfully',
      data: {
        totalProducts: stats.TotalProducts,
        existingSplits: stats.ExistingSplits,
        note: 'Using your real product database - no sample data needed'
      }
    });

  } catch (error) {
    console.error('Database seeding error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to seed database', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function createTablesIfNotExists(pool: any) {
  try {
    // Create Events table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Events' AND xtype='U')
      CREATE TABLE dbo.Events (
          ProdID INT PRIMARY KEY,
          ProdName NVARCHAR(255),
          EventDate DATE,
          Country NVARCHAR(100),
          Venue NVARCHAR(255),
          Trainer_1 NVARCHAR(100)
      );
    `);

    // Create EventTickets table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EventTickets' AND xtype='U')
      CREATE TABLE dbo.EventTickets (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          ProdID INT,
          Attendance NVARCHAR(50),
          PaymentMethod NVARCHAR(50),
          TierLevel NVARCHAR(50),
          PriceTotal MONEY,
          TrainerFeePct DECIMAL(5,2),
          Quantity INT,
          DeletedTicket BIT DEFAULT 0,
          FOREIGN KEY (ProdID) REFERENCES dbo.Events(ProdID)
      );
    `);

    // Create EventTrainerSplits table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='EventTrainerSplits' AND xtype='U')
      CREATE TABLE dbo.EventTrainerSplits (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          ProdID INT,
          RowId INT,
          Name NVARCHAR(200),
          Percent DECIMAL(5,2),
          CashReceived MONEY,
          CreatedAt DATETIME2,
          UpdatedAt DATETIME2,
          FOREIGN KEY (ProdID) REFERENCES dbo.Events(ProdID)
      );
    `);

    // Create AuditLog table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AuditLog' AND xtype='U')
      CREATE TABLE dbo.AuditLog (
          ID INT IDENTITY(1,1) PRIMARY KEY,
          UserId NVARCHAR(50),
          Action NVARCHAR(100),
          ProdId INT,
          Details NVARCHAR(MAX),
          CreatedAt DATETIME2
      );
    `);

    console.log('Database tables created/verified');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}
