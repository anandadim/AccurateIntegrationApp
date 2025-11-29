# Quick Commands Reference

## Setup

```bash
# Install PostgreSQL (Windows)
# Download from https://www.postgresql.org/download/windows/

# Or use Docker
docker run --name postgres-accurate -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=accurate_db -p 5432:5432 -d postgres:15

# Install dependencies
npm install

# Test database connection
npm run test:db
```

## Development

```bash
# Start backend
npm run dev

# Start frontend (new terminal)
npm run frontend

# Test database
npm run test:db
```

## Sync Sales Invoices

```bash
# Sync Branch 1 (today)
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1"

# Sync Branch 1 (date range)
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30&maxItems=100"

# Sync Branch 2
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-2&dateFrom=2025-11-01&dateTo=2025-11-30"

# Sync Branch 3
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-3&dateFrom=2025-11-01&dateTo=2025-11-30"
```

## Query Data

```bash
# Get invoices from branch-1
curl "http://localhost:3000/api/sales-invoices?branchId=branch-1&limit=10"

# Get invoices by date
curl "http://localhost:3000/api/sales-invoices?dateFrom=2025-11-01&dateTo=2025-11-30&limit=50"

# Get all invoices (all branches)
curl "http://localhost:3000/api/sales-invoices?limit=100"

# Get invoice detail
curl "http://localhost:3000/api/sales-invoices/1"

# Get summary
curl "http://localhost:3000/api/sales-invoices/summary/stats"

# Get summary by branch
curl "http://localhost:3000/api/sales-invoices/summary/stats?branchId=branch-1"
```

## PostgreSQL Commands

```bash
# Connect to database
psql -U postgres -d accurate_db

# List tables
\dt

# Describe table
\d sales_invoices

# Count records
SELECT COUNT(*) FROM sales_invoices;

# Sample data
SELECT * FROM sales_invoices LIMIT 5;

# Summary by branch
SELECT branch_name, COUNT(*), SUM(total) 
FROM sales_invoices 
GROUP BY branch_name;

# Exit
\q
```

## Useful SQL Queries

```sql
-- Count invoices per branch
SELECT branch_name, COUNT(*) as total
FROM sales_invoices
GROUP BY branch_name;

-- Total sales per branch
SELECT branch_name, SUM(total) as total_sales
FROM sales_invoices
GROUP BY branch_name
ORDER BY total_sales DESC;

-- Top customers
SELECT customer_name, COUNT(*) as invoice_count, SUM(total) as total_sales
FROM sales_invoices
GROUP BY customer_name
ORDER BY total_sales DESC
LIMIT 10;

-- Daily sales
SELECT trans_date, COUNT(*) as invoices, SUM(total) as daily_sales
FROM sales_invoices
WHERE trans_date >= '2025-11-01'
GROUP BY trans_date
ORDER BY trans_date;

-- Top selling items
SELECT item_no, item_name, SUM(quantity) as total_qty, SUM(amount) as total_amount
FROM sales_invoice_items
GROUP BY item_no, item_name
ORDER BY total_amount DESC
LIMIT 20;

-- Invoice with items
SELECT 
  si.invoice_number,
  si.customer_name,
  si.total,
  COUNT(sii.id) as item_count
FROM sales_invoices si
LEFT JOIN sales_invoice_items sii ON si.id = sii.invoice_id
GROUP BY si.id, si.invoice_number, si.customer_name, si.total
ORDER BY si.trans_date DESC
LIMIT 10;
```

## Backup & Restore

```bash
# Backup database
pg_dump -U postgres -d accurate_db > backup_20251120.sql

# Restore database
psql -U postgres -d accurate_db < backup_20251120.sql

# Backup specific table
pg_dump -U postgres -d accurate_db -t sales_invoices > sales_invoices_backup.sql
```

## Troubleshooting

```bash
# Check PostgreSQL is running
pg_isready

# Check port
netstat -ano | findstr :5432

# Restart PostgreSQL (Windows)
# services.msc → postgresql-x64-15 → Restart

# Docker: Restart container
docker restart postgres-accurate

# Docker: View logs
docker logs postgres-accurate

# Docker: Connect to container
docker exec -it postgres-accurate psql -U postgres -d accurate_db
```

## Performance

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check indexes
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM sales_invoices 
WHERE branch_id = 'branch-1' 
AND trans_date >= '2025-11-01';

-- Vacuum (optimize)
VACUUM ANALYZE sales_invoices;
VACUUM ANALYZE sales_invoice_items;
```

## Batch Sync All Branches

```bash
# Windows (PowerShell)
$branches = @('branch-1', 'branch-2', 'branch-3')
$dateFrom = '2025-11-01'
$dateTo = '2025-11-30'

foreach ($branch in $branches) {
  Write-Host "Syncing $branch..."
  curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=$branch&dateFrom=$dateFrom&dateTo=$dateTo&maxItems=100"
}
```

## Export Data

```bash
# Export to CSV (from PostgreSQL)
psql -U postgres -d accurate_db -c "COPY (SELECT * FROM sales_invoices WHERE trans_date >= '2025-11-01') TO STDOUT WITH CSV HEADER" > invoices.csv

# Export items to CSV
psql -U postgres -d accurate_db -c "COPY (SELECT * FROM sales_invoice_items) TO STDOUT WITH CSV HEADER" > items.csv
```

---

**Quick Reference for Daily Use**
