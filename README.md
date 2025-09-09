# Salsation Event Reports Dashboard

A comprehensive dashboard application for managing and reporting on Salsation training events, built with Next.js 14, TypeScript, and SQL Server.

## Features

### 🔐 Authentication & Authorization
- **NextAuth.js** with credentials and Google OAuth providers
- **Role-based access control** (admin, finance, trainer, viewer)
- **Secure session management** with JWT tokens

### 📊 Event Management
- **Event search and selection** with ProdID/ProdName lookup
- **Detailed event reporting** with ticket aggregation
- **Trainer fee calculations** with configurable percentages
- **Cash sales tracking** and commission management

### 🧮 Financial Calculations
- **Automated fee calculations** based on ticket sales
- **Trainer split management** (blue cells editor)
- **Currency formatting** with German locale (EUR)
- **Commission tracking** (Grace, Nanna fees)

### 📈 Data Visualization
- **KPI cards** for key metrics (Trainer Fee, Cash Sales, Balance)
- **Pivot-style data tables** with grouping and sorting
- **Real-time calculations** and validation

### 📋 Export Capabilities
- **Excel (XLSX)** export with formatted sheets
- **CSV export** for data analysis
- **PDF reports** via Puppeteer
- **Role-based export permissions**

### 🔒 Security
- **Content Security Policy** headers
- **Rate limiting** on export endpoints
- **Audit logging** for sensitive operations
- **SQL injection protection** with parameterized queries

## Tech Stack

### Frontend
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **TailwindCSS** for styling
- **shadcn/ui** component library
- **Lucide React** icons
- **TanStack Query** for state management

### Backend
- **NextAuth.js** for authentication
- **SQL Server** with mssql driver
- **Server Actions** for data mutations
- **API Routes** for RESTful endpoints

### Export & Processing
- **ExcelJS** for XLSX generation
- **csv-stringify** for CSV export
- **Puppeteer** for PDF generation

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth configuration
│   │   └── events/                 # Event API endpoints
│   ├── globals.css                 # Global styles with CSS variables
│   ├── layout.tsx                  # Root layout
│   └── page.tsx                    # Home page
├── components/
│   └── ui/                         # shadcn/ui components
├── lib/
│   ├── auth.ts                     # Authentication configuration
│   ├── database.ts                 # Database connection & queries
│   ├── middleware.ts               # API middleware
│   └── utils.ts                    # Utility functions
└── types/
    ├── index.ts                    # Shared TypeScript types
    └── next-auth.d.ts              # NextAuth type extensions
```

## Setup Instructions

### Prerequisites
- **Node.js** 18+ and npm
- **SQL Server** instance
- **Google Cloud Console** project (for OAuth, optional)

### 1. Installation

```bash
# Clone or download the project
cd salsation-event-reports

# Install dependencies
npm install
```

### 2. Environment Configuration

Create `.env.local` file (copy from `.env.example`):

```bash
# Database Configuration
MSSQL_SERVER=your-server-host
MSSQL_DATABASE=your-database-name
MSSQL_USER=your-username
MSSQL_PASSWORD=your-password
MSSQL_ENCRYPT=true

# NextAuth Configuration
NEXTAUTH_SECRET=your-random-secret-key
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Database Setup

#### Required Tables

```sql
-- Events table
CREATE TABLE dbo.Events (
    ProdID INT PRIMARY KEY,
    ProdName NVARCHAR(255),
    EventDate DATE,
    Country NVARCHAR(100),
    Venue NVARCHAR(255),
    Trainer_1 NVARCHAR(100)
);

-- Event tickets table
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

-- Trainer splits table
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

-- Audit log table
CREATE TABLE dbo.AuditLog (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    UserId NVARCHAR(50),
    Action NVARCHAR(100),
    ProdId INT,
    Details NVARCHAR(MAX),
    CreatedAt DATETIME2
);
```

#### Sample Data

```sql
-- Sample event
INSERT INTO dbo.Events (ProdID, ProdName, EventDate, Country, Venue, Trainer_1)
VALUES (77619, 'SALSATION Workshop with Will, Venue, Hannover - Germany, 30 August 2025', '2025-08-30', 'Germany', 'Venue', 'Will');

-- Sample tickets
INSERT INTO dbo.EventTickets (ProdID, Attendance, PaymentMethod, TierLevel, PriceTotal, TrainerFeePct, Quantity)
VALUES 
(77619, 'Attended', 'Paypal', 'Early Bird', 50.00, 0.7, 48),
(77619, 'Attended', 'Paypal', 'Regular', 65.00, 0.7, 2),
(77619, 'Attended', 'Paypal', 'Troupe', 40.00, 0.7, 28),
(77619, 'Attended', 'Paypal', 'Rush', 80.00, 0.7, 2),
(77619, 'Free Ticket', NULL, NULL, 0.00, 0.7, 1);
```

### 4. Database Seeding

**Option 1: Automatic Setup (Recommended)**

```bash
# Seed the database with sample data
npm run seed

# Or for explicit development mode
npm run seed:dev
```

**Option 2: Manual Setup**

Call the seeding endpoint directly:

```bash
curl -X POST http://localhost:3000/api/seed
```

This will:
- Create all required database tables
- Insert sample events (including event ID 77619)
- Add sample tickets with various payment methods and tiers
- Create sample trainer splits for testing

### 5. Development

```bash
# Start development server
npm run dev

# Open browser
http://localhost:3000
```

### 6. Demo Credentials

For testing, use these demo accounts:

- **Admin**: `admin@salsation.com` / `admin123`
- **Finance**: `finance@salsation.com` / `finance123`
- **Trainer**: `trainer@salsation.com` / `trainer123`
- **Viewer**: `viewer@salsation.com` / `viewer123`

## User Roles & Permissions

| Role | Read Events | Export Data | Edit Trainer Splits | Full Access |
|------|-------------|-------------|-------------------|-------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Finance** | ✅ | ✅ | ✅ | ❌ |
| **Trainer** | ✅ | ✅ (own events) | ✅ (own events) | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ |

## API Endpoints

### Authentication
- `GET/POST /api/auth/[...nextauth]` - NextAuth endpoints

### Events
- `GET /api/events` - List events with optional search
- `GET /api/events/[prodId]` - Get event details with tickets
- `POST /api/events/[prodId]/splits` - Save trainer splits
- `POST /api/events/[prodId]/export` - Export event data

## Development Status

### ✅ Completed Components
- **Full project setup** and configuration
- **Database connection** with SQL Server and parameterized queries
- **Authentication** with NextAuth.js (credentials + Google OAuth)
- **Complete API routes** with role-based middleware
- **Full UI implementation** with shadcn/ui components
- **Login page** with authentication forms and demo accounts
- **Dashboard layout** with header, user menu, and role badges
- **Event picker** with searchable combobox functionality
- **KPI cards** displaying financial metrics with real-time calculations
- **Data table** with pivot-style grouping and formatting
- **Trainer splits editor** (blue cells) with validation
- **Export functionality** (XLSX, CSV, PDF) with role-based permissions
- **React Query** setup for data fetching and caching
- **TypeScript types** and comprehensive interfaces
- **Currency formatting** with German locale (EUR)
- **Security headers**, rate limiting, and audit logging
- **Database seeding** utilities with sample data
- **Role-based permissions** throughout the application

### 🎯 Application Status: **COMPLETE & READY FOR TESTING**

The application is fully functional with all specified features implemented. You can:
1. **Authenticate** with demo accounts (different roles)
2. **Search and select events** from the database
3. **View financial calculations** and KPI metrics
4. **Edit trainer splits** with real-time validation
5. **Export reports** in multiple formats
6. **Test role-based permissions** across all features

## Deployment

### Production Checklist
- [ ] Set strong `NEXTAUTH_SECRET`
- [ ] Configure production database
- [ ] Set up SSL certificates
- [ ] Configure Google OAuth (if used)
- [ ] Enable database connection pooling
- [ ] Set up monitoring and logging
- [ ] Test export functionality with Puppeteer

### Environment Variables for Production
```bash
NODE_ENV=production
NEXTAUTH_URL=https://your-domain.com
# ... other variables
```

## Contributing

1. Follow the existing code structure
2. Use TypeScript for type safety
3. Follow the established patterns for:
   - Database queries (parameterized)
   - API routes (with middleware)
   - Component structure (shadcn/ui)
   - Error handling and validation

## Security Considerations

- **SQL Injection**: All queries use parameterized statements
- **Authentication**: Secure session management with NextAuth.js
- **Authorization**: Role-based access control on all endpoints
- **Rate Limiting**: Export endpoints have rate limits
- **Audit Trail**: All sensitive operations are logged
- **HTTPS**: Required for production deployment

## License

Private project for Salsation Event Management.
