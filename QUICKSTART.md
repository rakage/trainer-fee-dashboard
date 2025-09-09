# 🚀 Quick Start Guide

Get the Salsation Event Reports dashboard running in 5 minutes!

## Prerequisites

- **Node.js** 18+ installed
- **SQL Server** instance available
- **Basic familiarity** with environment variables

## Step-by-Step Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env.local` file:
```bash
# Copy the template
cp .env.example .env.local
```

Edit `.env.local` with your database details:
```env
MSSQL_SERVER=your-server-host
MSSQL_DATABASE=your-database-name  
MSSQL_USER=your-username
MSSQL_PASSWORD=your-password
MSSQL_ENCRYPT=true

NEXTAUTH_SECRET=your-super-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

### 3. Start the Application
```bash
npm run dev
```

### 4. Seed the Database
In a new terminal:
```bash
npm run seed
```

### 5. Test the Application
1. Open [http://localhost:3000](http://localhost:3000)
2. Login with demo credentials:
   - **Admin**: `admin@salsation.com` / `admin123`
   - **Finance**: `finance@salsation.com` / `finance123`
   - **Trainer**: `trainer@salsation.com` / `trainer123`
   - **Viewer**: `viewer@salsation.com` / `viewer123`

## What to Test

### 🔐 Authentication
- Try different user roles
- Notice the role badge in the header
- Test role-based feature access

### 📊 Event Management
- Search for events (try "Will" or "77619")
- Select the sample event
- View calculated KPI cards

### 💰 Financial Features
- Adjust Grace Commission and Nanna Fee
- Watch real-time calculation updates
- View the detailed data table

### ✏️ Trainer Splits (Blue Cells)
- Add/remove trainer split rows
- Enter percentages and cash amounts
- See validation for >100% totals
- Save splits to database

### 📋 Export Features
- Export as XLSX (full formatting)
- Export as CSV (data only)
- Export as PDF (text format)
- Note: Viewer role cannot export

## Troubleshooting

### Database Connection Issues
- Verify SQL Server is running
- Check connection string in `.env.local`
- Ensure user has proper permissions

### Seeding Fails
- Check database connectivity first
- Verify tables don't already exist with conflicting data
- Run: `npm run seed` again (it clears old data)

### Login Issues
- Make sure `NEXTAUTH_SECRET` is set
- Clear browser cookies if issues persist
- Check console for authentication errors

## Sample Data Overview

After seeding, you'll have:
- **3 events** (ID: 77619, 77620, 77621)
- **8 ticket types** with various payment methods
- **2 trainer splits** for testing blue cells
- **Multiple attendance** statuses and tiers

## Next Steps

1. **Customize** the sample data in `src/app/api/seed/route.ts`
2. **Connect** to your real database
3. **Configure** Google OAuth for production
4. **Deploy** to your hosting platform

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure proper SSL certificates
3. Set strong `NEXTAUTH_SECRET`
4. Update `NEXTAUTH_URL` to your domain
5. Test all functionality thoroughly

---

**Need help?** Check the main README.md for detailed documentation and architecture information.
