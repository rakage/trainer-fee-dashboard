# SQLite to PostgreSQL Migration Guide

This guide explains how to migrate your Salsation Event Reports application from SQLite to PostgreSQL.

## Overview

The application currently uses two databases:
- **SQLite**: For application-specific data (users, trainer splits, expenses, fee parameters, etc.)
- **MSSQL**: For main event data from nopCommerce (this remains unchanged)

This migration moves the SQLite data to PostgreSQL while keeping the MSSQL connection intact.

## Prerequisites

1. **PostgreSQL Server**: You need a running PostgreSQL server (local or remote)
2. **Database Created**: Create an empty PostgreSQL database for the application
3. **Environment Variables**: Configure PostgreSQL connection in `.env.local`

### Required Environment Variables

Add these to your `.env.local` file:

```env
# PostgreSQL Database Configuration
POSTGRES_HOST=localhost          # or your PostgreSQL server address
POSTGRES_PORT=5432              # default PostgreSQL port
POSTGRES_DATABASE=salsation_db  # your database name
POSTGRES_USER=postgres          # your PostgreSQL username
POSTGRES_PASSWORD=your_password # your PostgreSQL password
```

## Migration Steps

### Step 1: Backup Your SQLite Database

Before starting the migration, backup your current SQLite database:

**For Development:**
```bash
cp dev-users.db dev-users.db.backup
```

**For Production:**
```bash
cp users.db users.db.backup
```

### Step 2: Configure PostgreSQL Connection

1. Ensure PostgreSQL is running
2. Create a database:
   ```sql
   CREATE DATABASE salsation_db;
   ```
3. Update your `.env.local` file with the correct credentials

### Step 3: Test PostgreSQL Connection

You can test the connection using `psql` or any PostgreSQL client:

```bash
psql -h localhost -U postgres -d salsation_db
```

### Step 4: Run the Migration Script

Execute the migration script:

```bash
npm run migrate:postgres
```

The script will:
1. ✅ Test PostgreSQL connection
2. ✅ Create all required tables with proper indexes
3. ✅ Migrate data from SQLite to PostgreSQL
4. ✅ Verify data integrity
5. ✅ Display migration statistics

### Step 5: Update Application Code

After successful migration, you need to update your code to use PostgreSQL instead of SQLite:

#### Option A: Replace sqlite.ts imports

Replace all imports from `./sqlite` to `./postgres`:

```typescript
// Before
import { UserService, FeeParamService } from './sqlite';

// After
import { UserService, FeeParamService } from './postgres';
```

#### Option B: Rename files

```bash
# Backup original SQLite file
mv src/lib/sqlite.ts src/lib/sqlite.ts.backup

# Use PostgreSQL as the new sqlite
cp src/lib/postgres.ts src/lib/sqlite.ts
```

### Step 6: Test the Application

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Test key functionality:
   - User authentication
   - Event details loading
   - Trainer splits management
   - Expenses tracking
   - Fee parameters

### Step 7: Verify Data

Compare critical data between SQLite and PostgreSQL:

```bash
# SQLite
sqlite3 dev-users.db "SELECT COUNT(*) FROM users;"
sqlite3 dev-users.db "SELECT COUNT(*) FROM trainer_splits;"

# PostgreSQL
psql -h localhost -U postgres -d salsation_db -c "SELECT COUNT(*) FROM users;"
psql -h localhost -U postgres -d salsation_db -c "SELECT COUNT(*) FROM trainer_splits;"
```

## Tables Migrated

The migration script handles these tables:

| Table | Description |
|-------|-------------|
| `users` | User accounts and authentication |
| `fee_params` | Trainer fee calculation parameters |
| `trainer_splits` | Event-specific trainer payment splits |
| `expenses` | Event expenses tracking |
| `audit_log` | Audit trail for changes |
| `grace_price_conversion` | JPY to EUR price conversions for Japan events |
| `param_reporting_grp` | Alejandro trainer fee configuration |

## Rollback Plan

If you encounter issues, you can rollback:

1. Stop the application
2. Restore the SQLite backup:
   ```bash
   cp dev-users.db.backup dev-users.db
   ```
3. Revert code changes (if you modified imports)
4. Restart the application

## Differences Between SQLite and PostgreSQL

### Data Types

- **SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`** → **PostgreSQL `SERIAL PRIMARY KEY`**
- **SQLite `REAL`** → **PostgreSQL `REAL`** (same)
- **SQLite `TEXT`** → **PostgreSQL `TEXT`** (same)
- **SQLite `DATETIME`** → **PostgreSQL `TIMESTAMP`**

### Query Syntax

- **Case-insensitive search**: 
  - SQLite: `LIKE '%search%'`
  - PostgreSQL: `ILIKE '%search%'`

- **Date functions**:
  - SQLite: `CURRENT_TIMESTAMP`
  - PostgreSQL: `CURRENT_TIMESTAMP` (same)

### Transactions

Both databases support transactions, but PostgreSQL has more advanced features like:
- Row-level locking
- MVCC (Multi-Version Concurrency Control)
- Better concurrent write performance

## Performance Considerations

PostgreSQL generally offers better performance for:
- **Concurrent writes**: Multiple users updating data simultaneously
- **Complex queries**: Advanced joins and aggregations
- **Large datasets**: Better indexing and query optimization
- **Scalability**: Can handle larger databases more efficiently

## Troubleshooting

### Connection Refused

**Error**: `Connection refused` or `ECONNREFUSED`

**Solution**:
1. Ensure PostgreSQL is running:
   ```bash
   # Windows
   pg_ctl status

   # Linux/Mac
   sudo systemctl status postgresql
   ```
2. Check the correct host and port in `.env.local`
3. Verify firewall settings

### Authentication Failed

**Error**: `password authentication failed`

**Solution**:
1. Verify username and password in `.env.local`
2. Check PostgreSQL's `pg_hba.conf` authentication settings
3. Ensure the user has proper permissions:
   ```sql
   GRANT ALL PRIVILEGES ON DATABASE salsation_db TO postgres;
   ```

### Table Already Exists

**Error**: `relation "users" already exists`

**Solution**:
The migration script drops existing tables before creating new ones. If you see this error:
1. Manually drop tables:
   ```sql
   DROP TABLE IF EXISTS audit_log CASCADE;
   DROP TABLE IF EXISTS expenses CASCADE;
   DROP TABLE IF EXISTS trainer_splits CASCADE;
   DROP TABLE IF EXISTS grace_price_conversion CASCADE;
   DROP TABLE IF EXISTS param_reporting_grp CASCADE;
   DROP TABLE IF EXISTS fee_params CASCADE;
   DROP TABLE IF EXISTS users CASCADE;
   ```
2. Re-run the migration script

### Data Mismatch

**Error**: Row counts don't match between SQLite and PostgreSQL

**Solution**:
1. Check the migration output for errors
2. Verify no data was added during migration
3. Re-run the migration on a fresh database

## Production Deployment

For production deployment:

1. **Schedule Downtime**: Plan a maintenance window
2. **Backup Everything**: Backup both SQLite and any existing PostgreSQL data
3. **Test in Staging**: Run migration on staging environment first
4. **Run Migration**: Execute during maintenance window
5. **Verify Data**: Thoroughly test all features
6. **Monitor**: Watch logs for any errors
7. **Keep Backup**: Keep SQLite backup for at least 2 weeks

## Support

If you encounter issues during migration:

1. Check the migration script output for specific errors
2. Review PostgreSQL logs for connection issues
3. Verify all environment variables are correct
4. Ensure PostgreSQL version is 12 or higher (recommended: 14+)

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js pg module](https://node-postgres.com/)
- [SQLite to PostgreSQL conversion guide](https://wiki.postgresql.org/wiki/Converting_from_other_Databases_to_PostgreSQL#SQLite)
