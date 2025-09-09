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
    const pool = await getConnection();
    
    console.log('Starting database seeding...');

    // Create tables if they don't exist
    await createTablesIfNotExists(pool);

    // Clear existing sample data
    await pool.request().query(`
      DELETE FROM dbo.EventTrainerSplits WHERE ProdID IN (77619, 77620, 77621);
      DELETE FROM dbo.EventTickets WHERE ProdID IN (77619, 77620, 77621);
      DELETE FROM dbo.Events WHERE ProdID IN (77619, 77620, 77621);
    `);

    // Insert sample events
    const allEvents = [sampleEvent, ...additionalEvents];
    
    for (const event of allEvents) {
      const request = pool.request();
      request.input('ProdID', event.ProdID);
      request.input('ProdName', event.ProdName);
      request.input('EventDate', event.EventDate);
      request.input('Country', event.Country);
      request.input('Venue', event.Venue);
      request.input('Trainer_1', event.Trainer_1);

      await request.query(`
        INSERT INTO dbo.Events (ProdID, ProdName, EventDate, Country, Venue, Trainer_1)
        VALUES (@ProdID, @ProdName, @EventDate, @Country, @Venue, @Trainer_1)
      `);
    }

    // Insert sample tickets for the main event
    for (const ticket of sampleTickets) {
      const request = pool.request();
      request.input('ProdID', sampleEvent.ProdID);
      request.input('Attendance', ticket.Attendance);
      request.input('PaymentMethod', ticket.PaymentMethod);
      request.input('TierLevel', ticket.TierLevel);
      request.input('PriceTotal', ticket.PriceTotal);
      request.input('TrainerFeePct', ticket.TrainerFeePct);
      request.input('Quantity', ticket.Quantity);

      await request.query(`
        INSERT INTO dbo.EventTickets 
        (ProdID, Attendance, PaymentMethod, TierLevel, PriceTotal, TrainerFeePct, Quantity, DeletedTicket)
        VALUES (@ProdID, @Attendance, @PaymentMethod, @TierLevel, @PriceTotal, @TrainerFeePct, @Quantity, 0)
      `);
    }

    // Add some tickets for additional events
    const additionalTickets = [
      { ProdID: 77620, Attendance: 'Attended', PaymentMethod: 'Paypal', TierLevel: 'Regular', PriceTotal: 75.00, TrainerFeePct: 0.65, Quantity: 25 },
      { ProdID: 77620, Attendance: 'Attended', PaymentMethod: 'Cash', TierLevel: 'Regular', PriceTotal: 75.00, TrainerFeePct: 0.65, Quantity: 8 },
      { ProdID: 77621, Attendance: 'Attended', PaymentMethod: 'Paypal', TierLevel: 'Premium', PriceTotal: 120.00, TrainerFeePct: 0.8, Quantity: 15 }
    ];

    for (const ticket of additionalTickets) {
      const request = pool.request();
      request.input('ProdID', ticket.ProdID);
      request.input('Attendance', ticket.Attendance);
      request.input('PaymentMethod', ticket.PaymentMethod);
      request.input('TierLevel', ticket.TierLevel);
      request.input('PriceTotal', ticket.PriceTotal);
      request.input('TrainerFeePct', ticket.TrainerFeePct);
      request.input('Quantity', ticket.Quantity);

      await request.query(`
        INSERT INTO dbo.EventTickets 
        (ProdID, Attendance, PaymentMethod, TierLevel, PriceTotal, TrainerFeePct, Quantity, DeletedTicket)
        VALUES (@ProdID, @Attendance, @PaymentMethod, @TierLevel, @PriceTotal, @TrainerFeePct, @Quantity, 0)
      `);
    }

    // Add some sample trainer splits
    const sampleSplits = [
      { ProdID: 77619, RowId: 1, Name: 'Will', Percent: 70.0, CashReceived: 100.0 },
      { ProdID: 77619, RowId: 2, Name: 'Assistant Trainer', Percent: 30.0, CashReceived: 50.0 }
    ];

    for (const split of sampleSplits) {
      const request = pool.request();
      request.input('ProdID', split.ProdID);
      request.input('RowId', split.RowId);
      request.input('Name', split.Name);
      request.input('Percent', split.Percent);
      request.input('CashReceived', split.CashReceived);

      await request.query(`
        INSERT INTO dbo.EventTrainerSplits 
        (ProdID, RowId, Name, Percent, CashReceived, CreatedAt)
        VALUES (@ProdID, @RowId, @Name, @Percent, @CashReceived, SYSDATETIME())
      `);
    }

    console.log('Database seeding completed successfully');

    // Get summary statistics
    const statsRequest = pool.request();
    const stats = await statsRequest.query(`
      SELECT 
        (SELECT COUNT(*) FROM dbo.Events WHERE ProdID IN (77619, 77620, 77621)) as EventCount,
        (SELECT COUNT(*) FROM dbo.EventTickets WHERE ProdID IN (77619, 77620, 77621)) as TicketCount,
        (SELECT COUNT(*) FROM dbo.EventTrainerSplits WHERE ProdID IN (77619, 77620, 77621)) as SplitCount
    `);

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      data: {
        events: stats.recordset[0].EventCount,
        tickets: stats.recordset[0].TicketCount,
        splits: stats.recordset[0].SplitCount,
        sampleEventId: 77619
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
