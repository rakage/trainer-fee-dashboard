# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Essential Development Commands

### Quick Start
```bash
# Initial setup
npm install
cp .env.example .env.local  # Configure database connection
npm run dev                 # Start development server on :3000
npm run seed               # Initialize database with sample data
```

### Core Development Workflow
```bash
npm run dev                # Development server with Turbopack
npm run build             # Production build with Turbopack  
npm run start             # Production server
npm run lint              # ESLint code linting
```

### Database Management
```bash
npm run seed              # Seed database with sample events and test users
npm run seed:dev          # Explicit development environment seeding
```

### Testing Event Data
After seeding, test with these sample events:
- **Event ID 77619**: "SALSATION Workshop with Will" (main test event)
- **Demo logins**: admin@salsation.com/admin123, finance@salsation.com/finance123

## Architecture Overview

### Hybrid Database Architecture
This application uses a **dual-database approach**:

**SQL Server (Primary)**: Production business data
- Events, orders, tickets, customers from the main Salsation e-commerce system  
- Complex queries with joins across multiple normalized tables
- Read-only for this application

**SQLite (Secondary)**: Application-specific data  
- User accounts, trainer splits, expenses, fee parameters
- Audit logging and session management
- Writable data that extends the business logic

### Key Architectural Patterns

**Database Service Layer** (`src/lib/database.ts`)
- `DatabaseService` class handles all SQL Server operations
- Complex event queries with trainer name extraction and fee calculation
- Connection pooling and parameterized queries for security

**Authentication & Authorization** (`src/lib/auth.ts`)
- NextAuth.js with dual providers (credentials + Google OAuth)
- Role-based access control: admin, finance, trainer, viewer
- SQLite-backed user management with automatic user creation for Google OAuth

**Data Flow Pattern**
1. Events fetched from SQL Server (read-only business data)
2. Trainer splits/expenses stored in SQLite (app-specific editable data)  
3. Fee percentages calculated via SQLite lookups using concatenated keys
4. Financial calculations happen client-side with server validation

### Component Structure

**App Router Layout**
- `/dashboard` - Main application with event reporting
- `/admin` - User management and activity logs  
- `/login` - Authentication forms
- API routes under `/api/` for data operations

**Key Components**
- `EventPicker` - Searchable event selection with complex SQL queries
- `TrainerSplits` - Editable blue cells for revenue distribution
- `ExportControls` - Multi-format report generation (XLSX, CSV, PDF)
- `OverviewCards` - Real-time KPI calculations

### Security Architecture

**SQL Injection Prevention**
- All SQL Server queries use parameterized statements
- No dynamic SQL concatenation anywhere in codebase

**Role-Based Security**
- `middleware.ts` enforces authentication on all API routes
- Each user action checks role permissions via `canAccessResource()`
- Audit logging tracks all data modifications

**Content Security Policy**  
- Strict CSP headers in `next.config.ts`
- Image and font restrictions for XSS prevention

## Development Guidelines

### Environment Configuration
Required `.env.local` variables:
```bash
MSSQL_SERVER=your-server-host        # SQL Server connection
MSSQL_DATABASE=your-database-name     
MSSQL_USER=your-username
MSSQL_PASSWORD=your-password
NEXTAUTH_SECRET=your-secret-key       # JWT signing key
NEXTAUTH_URL=http://localhost:3000    # OAuth callback URL
```

### Database Connection Patterns
- **Never** connect directly to SQL Server from components
- Use `DatabaseService` static methods for all data operations
- SQLite operations go through service classes (`TrainerSplitService`, `ExpenseService`, etc.)
- Connection pooling is handled automatically in `getConnection()`

### TypeScript Conventions
- All API responses use `ApiResponse<T>` wrapper type
- Event data follows `EventDetail` and `EventTicket` interfaces
- User roles strictly typed as `UserRole` union type
- Database result mapping happens in service layer, not components

### Financial Calculation Logic
- Trainer fee percentages stored in SQLite `fee_params` table
- Lookup key format: `{Program}-{Category}-{Venue}-{Attendance}`
- All currency formatting uses German locale (EUR) via `Intl.NumberFormat`
- Balance calculations: `TrainerFee - CashReceived - GraceCommission - NannaFee`

### Export System Architecture
- `ExcelJS` for XLSX with formatted cells and styling
- `csv-stringify` for data-only CSV exports  
- `Puppeteer` for PDF generation from HTML templates
- Role-based export permissions enforced at API level

### Component State Management
- `TanStack Query` for server state caching and synchronization
- React Query keys follow pattern: `['events', prodId]`, `['splits', prodId]`
- Optimistic updates for trainer splits with rollback on error
- No global state - all data flows through React Query cache

## Common Development Tasks

### Adding New User Roles
1. Update `UserRole` type in `src/types/index.ts`
2. Add permissions in `canAccessResource()` function
3. Update role-based UI conditionals in components
4. Test with new demo user in seeding script

### Modifying Fee Calculation Logic  
1. Update `getTrainerFeePercent()` in `DatabaseService`
2. Adjust concatenated key format if needed
3. Update SQLite `fee_params` seeding data
4. Test with various event types and attendance patterns

### Adding Export Formats
1. Create new export handler in `src/app/api/events/[prodId]/export/route.ts`  
2. Add format option to `ExportFormat` type
3. Update `ExportControls` component UI
4. Test role-based access restrictions

### Debugging Database Issues
- Check SQL Server connection with: Database connection logs in dev console
- SQLite database location: `./dev-users.db` (development)
- Use `sqlite3 dev-users.db` to inspect app-specific data directly
- Query logs available in server console during development
