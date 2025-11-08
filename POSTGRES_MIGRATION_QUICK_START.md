# PostgreSQL Migration - Quick Start Guide

## 🚀 Quick Migration Steps

### 1. Prerequisites Check
```bash
# Ensure PostgreSQL is installed and running
psql --version

# Create database
psql -U postgres -c "CREATE DATABASE salsation_db;"
```

### 2. Configure Environment
Add to `.env.local`:
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=salsation_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

### 3. Backup Current Database
```bash
# Development
cp dev-users.db dev-users.db.backup

# Production
cp users.db users.db.backup
```

### 4. Run Migration
```bash
npm run migrate:postgres
```

### 5. Verify Migration
```bash
npm run verify:migration
```

### 6. Update Code
Replace SQLite imports with PostgreSQL:
```typescript
// Change this:
import { UserService } from './sqlite';

// To this:
import { UserService } from './postgres';
```

Or simply rename the file:
```bash
mv src/lib/sqlite.ts src/lib/sqlite.ts.backup
cp src/lib/postgres.ts src/lib/sqlite.ts
```

### 7. Test Application
```bash
npm run dev
```

## 📊 What Gets Migrated

| Table | Description | Purpose |
|-------|-------------|---------|
| `users` | User accounts | Authentication & authorization |
| `fee_params` | Fee calculation rules | Trainer fee percentages |
| `trainer_splits` | Payment splits | Event-specific splits |
| `expenses` | Event expenses | Expense tracking |
| `audit_log` | Change history | Audit trail |
| `grace_price_conversion` | JPY/EUR rates | Japan events pricing |
| `param_reporting_grp` | Alejandro config | Special fee rules |

## 🔧 Available Commands

```bash
# Run migration
npm run migrate:postgres

# Verify migration
npm run verify:migration

# Seed database (if needed)
npm run seed
```

## ✅ Success Indicators

After migration, you should see:
- ✅ All table counts match
- ✅ Users data verified
- ✅ Fee params verified
- ✅ Trainer splits verified
- ✅ All indexes created
- ✅ All constraints applied

## ⚠️ Common Issues

### Connection Refused
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql  # Linux
pg_ctl status                     # Windows
```

### Authentication Failed
- Verify credentials in `.env.local`
- Check `pg_hba.conf` settings
- Ensure user has proper permissions

### Table Already Exists
- Migration script drops and recreates tables
- If error persists, manually drop tables first

## 🔄 Rollback Plan

If something goes wrong:
```bash
# 1. Stop the application
# 2. Restore SQLite backup
cp dev-users.db.backup dev-users.db

# 3. Revert code changes
git checkout src/lib/sqlite.ts

# 4. Restart application
npm run dev
```

## 📚 Full Documentation

For detailed information, see:
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Complete migration guide
- [scripts/migrate-sqlite-to-postgres.js](./scripts/migrate-sqlite-to-postgres.js) - Migration script
- [scripts/verify-migration.js](./scripts/verify-migration.js) - Verification script
- [src/lib/postgres.ts](./src/lib/postgres.ts) - PostgreSQL service implementation

## 🆘 Need Help?

1. Check migration script output for errors
2. Review PostgreSQL logs
3. Verify environment variables
4. Run verification script
5. Test with a fresh database

## 🎯 Benefits of PostgreSQL

- **Better Concurrency**: Multiple users can write simultaneously
- **Better Performance**: Optimized for larger datasets
- **Better Reliability**: Advanced backup and recovery
- **Better Scalability**: Handles growth more efficiently
- **Better Features**: Advanced SQL features and extensions

## 📝 Post-Migration Checklist

- [ ] Migration completed without errors
- [ ] Verification script passes all checks
- [ ] User authentication works
- [ ] Event data loads correctly
- [ ] Trainer splits can be saved
- [ ] Expenses can be tracked
- [ ] Fee parameters are accessible
- [ ] Application performs well
- [ ] SQLite backup stored safely
- [ ] Production deployment planned
