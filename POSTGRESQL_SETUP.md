# PostgreSQL Setup Guide

## Installation

### Windows

**Option 1: PostgreSQL Installer**
1. Download dari https://www.postgresql.org/download/windows/
2. Run installer
3. Default port: 5432
4. Set password untuk user `postgres`

**Option 2: Using Docker**
```bash
docker run --name postgres-accurate ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=accurate_db ^
  -p 5432:5432 ^
  -d postgres:15
```

### Verify Installation

```bash
# Check PostgreSQL is running
psql --version

# Connect to database
psql -U postgres -d accurate_db
```

## Database Setup

### 1. Create Database (if not using Docker)

```sql
-- Connect as postgres user
psql -U postgres

-- Create database
CREATE DATABASE accurate_db;

-- Connect to database
\c accurate_db

-- Verify
\l
```

### 2. Update .env File

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db
```

Format: `postgresql://[user]:[password]@[host]:[port]/[database]`

### 3. Install Dependencies

```bash
npm install
```

This will install `pg` (PostgreSQL client for Node.js)

### 4. Run Migration

```bash
# Start backend - it will auto-create tables
npm run dev
```

Tables yang akan dibuat:
- `sales_invoices` - Header invoice
- `sales_invoice_items` - Detail items
- `api_logs` - API call logs
- `accurate_data` - Cache data (backward compatibility)

## Database Schema

### sales_invoices
```sql
CREATE TABLE sales_invoices (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  branch_name VARCHAR(100),
  trans_date DATE NOT NULL,
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),
  salesman_id VARCHAR(50),
  salesman_name VARCHAR(100),
  warehouse_id VARCHAR(50),
  warehouse_name VARCHAR(100),
  subtotal DECIMAL(15,2),
  discount DECIMAL(15,2),
  tax DECIMAL(15,2),
  total DECIMAL(15,2) NOT NULL,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(invoice_id, branch_id)
);
```

### sales_invoice_items
```sql
CREATE TABLE sales_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  item_no VARCHAR(100) NOT NULL,
  item_name TEXT,
  quantity DECIMAL(15,2) NOT NULL,
  unit_name VARCHAR(50),
  unit_price DECIMAL(15,2) NOT NULL,
  discount DECIMAL(15,2) DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE
);
```

## API Endpoints

### Sync from Accurate API
```
POST /api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30&maxItems=100
```

### Get Invoices
```
GET /api/sales-invoices?branchId=branch-1&dateFrom=2025-11-01&limit=100&offset=0
```

### Get Invoice Detail
```
GET /api/sales-invoices/:id
```

### Get Summary
```
GET /api/sales-invoices/summary/stats?branchId=branch-1&dateFrom=2025-11-01
```

## Testing

### 1. Test Connection
```bash
# In psql
\conninfo
```

### 2. Test API
```bash
# Sync invoices
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30&maxItems=20"

# Get invoices
curl "http://localhost:3000/api/sales-invoices?branchId=branch-1&limit=10"

# Get summary
curl "http://localhost:3000/api/sales-invoices/summary/stats?branchId=branch-1"
```

### 3. Check Data in Database
```sql
-- Count invoices
SELECT branch_name, COUNT(*) 
FROM sales_invoices 
GROUP BY branch_name;

-- Check items
SELECT COUNT(*) FROM sales_invoice_items;

-- Sample data
SELECT * FROM sales_invoices LIMIT 5;
```

## Useful PostgreSQL Commands

```sql
-- List all tables
\dt

-- Describe table
\d sales_invoices

-- Check indexes
\di

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('sales_invoices'));

-- Vacuum (optimize)
VACUUM ANALYZE sales_invoices;
```

## Backup & Restore

### Backup
```bash
pg_dump -U postgres -d accurate_db > backup.sql
```

### Restore
```bash
psql -U postgres -d accurate_db < backup.sql
```

## Troubleshooting

### Connection Error
- Check PostgreSQL is running: `pg_isready`
- Check port: `netstat -an | findstr 5432`
- Verify credentials in .env

### Permission Error
```sql
GRANT ALL PRIVILEGES ON DATABASE accurate_db TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
```

### Reset Database
```sql
DROP DATABASE accurate_db;
CREATE DATABASE accurate_db;
```

## Performance Tips

1. **Indexes** - Already created for common queries
2. **Connection Pool** - Max 20 connections configured
3. **JSONB** - Use for flexible data storage
4. **Partitioning** - Consider for > 10M rows
5. **Vacuum** - Run weekly for optimization

## Migration from SQLite

If you have existing SQLite data:

1. Export from SQLite:
```bash
sqlite3 database/accurate.db .dump > sqlite_dump.sql
```

2. Convert and import to PostgreSQL (manual process)
3. Or use migration tool like `pgloader`

---

**Status:** Ready for Production  
**Database:** PostgreSQL 15+  
**Connection Pool:** 20 connections
