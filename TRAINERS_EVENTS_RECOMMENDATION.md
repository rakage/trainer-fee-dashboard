# Trainer's Events Query Timeout Issue

## Problem
The current query is too complex with too many CTEs (Common Table Expressions):
- 20+ CTEs processing data sequentially
- XML parsing for trainer names
- Complex trainer parameter matching
- Multiple UNION queries
- Extensive calculations

Even with NOLOCK hints and parallel processing, it times out.

## Recommended Solutions

### Option 1: Create a SQL Server Stored Procedure (BEST)
Create a stored procedure in the database that's pre-compiled and optimized:
```sql
CREATE PROCEDURE sp_GetTrainersEvents
    @Year INT = NULL,
    @Month INT = NULL
AS
BEGIN
    -- Your existing complex query here
    -- SQL Server will compile and optimize it once
END
```

Then call it from Node.js:
```typescript
const result = await request.execute('sp_GetTrainersEvents');
```

### Option 2: Create a Materialized View/Indexed View
Pre-compute the data in a database view that refreshes periodically.

### Option 3: Simplify the Query (QUICK FIX)
Return only essential data and do complex calculations in the application:
- Get basic event info
- Get order totals separately
- Get co-trainers separately
- Combine in Node.js

### Option 4: Split into Multiple Simpler Queries
Run 2-3 simpler queries and combine results in the application.

## Immediate Next Steps
1. Ask your DBA to create a stored procedure with the complex query
2. OR implement Option 3 (simplified query) for immediate functionality
3. Consider caching results for frequently accessed data

