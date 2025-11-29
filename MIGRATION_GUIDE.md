# Migration Guide: SQLite to PostgreSQL

## Overview

Project telah di-migrate dari SQLite ke PostgreSQL untuk support 16 cabang dengan concurrent operations.

## What Changed

### 1. Database
- ❌ SQLite (`database/accurate.db`)
- ✅ PostgreSQL (connection pool)

### 2. Dependencies
- ❌ `sqlite3`
- ✅ `pg` (node-postgres)

### 3. New Tables
- `sales_invoices` - Header invoice (optimized)
- `sales_invoice_items` - Detail items
- `api_logs` - API call logs
- `accurate_data` - Cache (backward compatibility)

### 4. New Endpoints
- `POST /api/sales-invoices/sync` - Sync from Accurate
- `GET /api/sales-invoices` - Query invoices
- `GET /api/sales-invoices/:id` - Get detail
- `GET /api/sales-invoices/summary/stats` - Statistics

## Migration Steps

### Step 1: Install PostgreSQL

**Windows:**
```bash
# Download installer from postgresql.org
# Or use Docker:
docker run --name postgres-accurate -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=accurate_db -p 5432:5432 -d postgres:15
```

**Verify:**
```bash
psql --version
```

### Step 2: Create Database

```bash
# Connect as postgres user
psql -U postgres

# Create database
CREATE DATABASE accurate_db;

# Exit
\q
```

### Step 3: Update .env

```env
# Old (SQLite)
# DB_PATH=./database/accurate.db

# New (PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db
```

### Step 4: Install Dependencies

```bash
npm install
```

This will install `pg` package.

### Step 5: Start Backend

```bash
npm run dev
```

Backend akan otomatis create tables di PostgreSQL.

### Step 6: Test Connection

```bash
npm run test:db
```

Expected output:
```
✅ Connected to PostgreSQL
PostgreSQL Version: PostgreSQL 15.x
📋 Tables:
  - sales_invoices
  - sales_invoice_items
  - api_logs
  - accurate_data
```

### Step 7: Sync Data

```bash
# Sync sales invoices
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30&maxItems=100"
```

### Step 8: Verify Data

```bash
# Get invoices
curl "http://localhost:3000/api/sales-invoices?branchId=branch-1&limit=10"

# Get summary
curl "http://localhost:3000/api/sales-invoices/summary/stats"
```

## Backward Compatibility

### Old Endpoints (Still Work)

```bash
# These still work with old cache table
GET /api/databases
GET /api/data/:endpoint
GET /api/cache/:endpoint
GET /api/details/:endpoint
```

### New Endpoints (Recommended)

```bash
# Use these for sales invoices
POST /api/sales-invoices/sync
GET /api/sales-invoices
GET /api/sales-invoices/:id
GET /api/sales-invoices/summary/stats
```

## Data Migration (Optional)

If you have existing SQLite data and want to migrate:

### Option 1: Re-sync from Accurate API

Recommended - just sync again from Accurate API:

```bash
# Sync all branches for last 30 days
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30"
```

### Option 2: Manual Export/Import

If you need to preserve old cache data:

```bash
# Export from SQLite
sqlite3 database/accurate.db .dump > sqlite_dump.sql

# Convert to PostgreSQL format (manual)
# Then import to PostgreSQL
psql -U postgres -d accurate_db < converted.sql
```

## Benefits of PostgreSQL

### 1. Concurrent Operations
- ✅ 16 cabang bisa sync bersamaan
- ✅ Multiple users bisa query bersamaan
- ❌ SQLite: only 1 writer at a time

### 2. Performance
- ✅ Optimized indexes
- ✅ Query planner
- ✅ Connection pooling
- ✅ Better for large datasets (> 1GB)

### 3. Features
- ✅ JSONB for flexible data
- ✅ Advanced queries (window functions, CTEs)
- ✅ Full-text search
- ✅ Partitioning support

### 4. Scalability
- ✅ Easy to scale vertically
- ✅ Can migrate to cloud (AWS RDS, etc)
- ✅ Replication support

## Troubleshooting

### Connection Error

**Error:** `ECONNREFUSED`

**Solution:**
```bash
# Check PostgreSQL is running
pg_isready

# Windows: Check service
services.msc
# Look for "postgresql-x64-15"

# Docker: Check container
docker ps
```

### Authentication Error

**Error:** `password authentication failed`

**Solution:**
```bash
# Reset password
psql -U postgres
ALTER USER postgres PASSWORD 'postgres';
```

### Database Not Found

**Error:** `database "accurate_db" does not exist`

**Solution:**
```bash
psql -U postgres
CREATE DATABASE accurate_db;
```

### Port Already in Use

**Error:** `port 5432 already in use`

**Solution:**
```bash
# Check what's using port 5432
netstat -ano | findstr :5432

# Kill process or change port in .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/accurate_db
```

## Rollback to SQLite

If you need to rollback:

### 1. Restore old files
```bash
git checkout backend/config/database.js
git checkout package.json
```

### 2. Update .env
```env
DB_PATH=./database/accurate.db
```

### 3. Reinstall dependencies
```bash
npm install
```

### 4. Restart backend
```bash
npm run dev
```

## Performance Comparison

### SQLite
- Small data (< 500MB): ⚡ Fast
- Concurrent writes: ❌ Slow (1 writer)
- Setup: ✅ Zero config
- Scalability: ⚠️ Limited

### PostgreSQL
- Small data: ⚡ Fast
- Large data (> 1GB): ⚡⚡ Very fast
- Concurrent writes: ✅ Excellent
- Setup: ⚠️ Requires installation
- Scalability: ✅ Excellent

## Next Steps

1. ✅ PostgreSQL setup complete
2. ✅ Tables created
3. ✅ API endpoints ready
4. 🔄 Sync data from all 16 branches
5. 🔄 Setup scheduler for auto-sync
6. 🔄 Build dashboard/reports
7. 🔄 Export to CSV

## Documentation

- [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) - Setup guide
- [SALES_INVOICE_API.md](SALES_INVOICE_API.md) - API documentation
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Schema reference

---

**Status:** Migration Complete ✅  
**Database:** PostgreSQL 15+  
**Ready for:** 16 Branches Production
