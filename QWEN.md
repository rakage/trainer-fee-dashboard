# Salsation Event Reports Dashboard - QWEN Context

## Project Overview

The Salsation Event Reports Dashboard is a comprehensive Next.js 15 application built with TypeScript for managing and reporting on Salsation training events. The application connects to a SQL Server database for business data and uses SQLite for application-specific data like user accounts and editable trainer splits. It features role-based authentication, financial calculations, and multi-format export capabilities.

### Key Features
- **Authentication & Authorization**: NextAuth.js with credentials and Google OAuth providers, role-based access control (admin, finance, trainer, viewer)
- **Event Management**: Event search and selection with ProdID/ProdName lookup, detailed event reporting with ticket aggregation
- **Financial Calculations**: Automated fee calculations based on ticket sales, trainer split management (blue cells editor), currency formatting with German locale (EUR)
- **Data Visualization**: KPI cards for key metrics, pivot-style data tables with grouping and sorting
- **Export Capabilities**: Excel (XLSX), CSV, and PDF exports with role-based permissions
- **Security**: Content Security Policy headers, rate limiting on export endpoints, audit logging, SQL injection protection

### Tech Stack
- **Frontend**: Next.js 15, TypeScript, TailwindCSS, shadcn/ui component library, Lucide React icons, TanStack Query
- **Backend**: NextAuth.js, SQL Server with mssql driver, Server Actions, API Routes
- **Export & Processing**: ExcelJS for XLSX generation, csv-stringify for CSV export, Puppeteer for PDF generation
- **Database**: SQL Server (primary business data) + SQLite (application-specific data, user management, trainer splits)

## Project Structure
```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth configuration
│   │   ├── events/                 # Event API endpoints
│   │   └── seed/                   # Database seeding endpoint
│   ├── dashboard/                  # Main dashboard page
│   ├── login/                      # Authentication page
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

## Building and Running

### Prerequisites
- Node.js 18+ and npm
- SQL Server instance
- Google Cloud Console project (for OAuth, optional)

### Environment Configuration
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

### Installation & Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Seed the database with sample data
npm run seed

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

### Demo Credentials
- **Admin**: `admin@salsation.com` / `admin123`
- **Finance**: `finance@salsation.com` / `finance123`
- **Trainer**: `trainer@salsation.com` / `trainer123`
- **Viewer**: `viewer@salsation.com` / `viewer123`

## Development Conventions

### User Roles & Permissions
| Role | Read Events | Export Data | Edit Trainer Splits | Full Access |
|------|-------------|-------------|-------------------|-------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ |
| **Finance** | ✅ | ✅ | ✅ | ❌ |
| **Trainer** | ✅ | ✅ (own events) | ✅ (own events) | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ |

### Database Architecture
The application uses a hybrid dual-database approach:
- **SQL Server (Primary)**: Production business data (events, orders, tickets, customers) - Read-only for this application
- **SQLite (Secondary)**: Application-specific data (user accounts, trainer splits, expenses, fee parameters) - Writable data

### Security
- SQL Injection Prevention: All queries use parameterized statements
- Role-Based Security: Middleware enforces authentication and permissions
- Content Security Policy: Strict headers in next.config.ts
- Audit Logging: All sensitive operations are logged

### Financial Calculation Logic
- Trainer fee percentages stored in SQLite `fee_params` table
- Lookup key format: `{Program}-{Category}-{Venue}-{Attendance}`
- Balance calculations: `TrainerFee - CashReceived - GraceCommission - NannaFee`
- Currency formatting uses German locale (EUR) via `Intl.NumberFormat`

### Export System
- ExcelJS for XLSX with formatted cells and styling
- csv-stringify for data-only CSV exports
- Puppeteer for PDF generation from HTML templates
- Role-based export permissions enforced at API level

### State Management
- TanStack Query for server state caching and synchronization
- React Query keys follow pattern: `['events', prodId]`, `['splits', prodId]`
- Optimistic updates for trainer splits with rollback on error

## API Endpoints
- `GET/POST /api/auth/[...nextauth]` - NextAuth endpoints
- `GET /api/events` - List events with optional search
- `GET /api/events/[prodId]` - Get event details with tickets
- `POST /api/events/[prodId]/splits` - Save trainer splits
- `POST /api/events/[prodId]/export` - Export event data
- `POST /api/seed` - Seed database with sample data

## Key Components
- `EventPicker` - Searchable event selection with complex SQL queries
- `TrainerSplits` - Editable blue cells for revenue distribution
- `ExportControls` - Multi-format report generation (XLSX, CSV, PDF)
- `OverviewCards` - Real-time KPI calculations
- `ExpensesEditor` - Managing event expenses

## Specialized Currency Handling
The application has implemented JPY currency display for Grace trainer events in Japan. When both conditions are met (trainer name contains 'grace' and country is Japan), amounts are displayed in JPY (¥) with Japanese locale (ja-JP) instead of EUR (€) with German locale (de-DE). This applies to dashboard components, export formats, and all financial displays.

## Troubleshooting
- Database Connection Issues: Verify SQL Server is running and connection string in `.env.local`
- Seeding Fails: Check database connectivity and ensure tables don't have conflicting data
- Login Issues: Ensure `NEXTAUTH_SECRET` is set and clear browser cookies if issues persist

## Production Deployment
- Set `NODE_ENV=production`
- Configure proper SSL certificates
- Set strong `NEXTAUTH_SECRET`
- Update `NEXTAUTH_URL` to your domain
- Enable database connection pooling
- Set up monitoring and logging
- Test export functionality with Puppeteer