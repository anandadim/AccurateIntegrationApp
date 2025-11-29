# Sales Invoice API Documentation

## Overview

API untuk mengelola data sales invoice dari Accurate Online dengan PostgreSQL sebagai database.

## Workflow

```
1. Sync from Accurate → PostgreSQL
2. Query from PostgreSQL (fast!)
3. Display/Export data
```

## Endpoints

### 1. Sync Sales Invoices

Fetch data dari Accurate API dan simpan ke PostgreSQL.

**Endpoint:** `POST /api/sales-invoices/sync`

**Query Parameters:**
- `branchId` (required) - ID cabang (branch-1, branch-2, dst)
- `dateFrom` (optional) - Tanggal mulai (YYYY-MM-DD), default: today
- `dateTo` (optional) - Tanggal akhir (YYYY-MM-DD), default: today
- `maxItems` (optional) - Max items to fetch, default: 100

**Example:**
```bash
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30&maxItems=50"
```

**Response:**
```json
{
  "success": true,
  "message": "Synced 45 invoices from Cabang 1 - Semarang",
  "summary": {
    "branch": "Cabang 1 - Semarang",
    "fetched": 45,
    "saved": 45,
    "errors": 0,
    "apiErrors": 0
  }
}
```

### 2. Get Sales Invoices

Query invoices dari database PostgreSQL.

**Endpoint:** `GET /api/sales-invoices`

**Query Parameters:**
- `branchId` (optional) - Filter by branch
- `dateFrom` (optional) - Filter by date range
- `dateTo` (optional) - Filter by date range
- `customerId` (optional) - Filter by customer
- `limit` (optional) - Limit results, default: 100
- `offset` (optional) - Offset for pagination, default: 0

**Example:**
```bash
# Get all invoices from branch-1
curl "http://localhost:3000/api/sales-invoices?branchId=branch-1&limit=10"

# Get invoices by date range
curl "http://localhost:3000/api/sales-invoices?dateFrom=2025-11-01&dateTo=2025-11-30"

# Get all invoices (all branches)
curl "http://localhost:3000/api/sales-invoices?limit=100"

# Pagination
curl "http://localhost:3000/api/sales-invoices?limit=50&offset=50"
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": 1,
      "invoice_id": 2425,
      "invoice_number": "SI.2025.11.00139",
      "branch_id": "branch-1",
      "branch_name": "Cabang 1 - Semarang",
      "trans_date": "2025-11-10",
      "customer_id": "C.00054",
      "customer_name": "Bp Didik Semarang",
      "salesman_name": "Muhammad Amir",
      "warehouse_name": "SEMARANG",
      "total": "19240000.00",
      "created_at": "2025-11-20T10:30:00.000Z"
    }
  ]
}
```

### 3. Get Invoice Detail

Get detail invoice dengan items.

**Endpoint:** `GET /api/sales-invoices/:id`

**Example:**
```bash
curl "http://localhost:3000/api/sales-invoices/1"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "invoice_number": "SI.2025.11.00139",
    "branch_name": "Cabang 1 - Semarang",
    "trans_date": "2025-11-10",
    "customer_name": "Bp Didik Semarang",
    "total": "19240000.00",
    "items": [
      {
        "id": 1,
        "item_no": "140010-14.075IN.02272",
        "item_name": "FLANK (AMROON)...",
        "quantity": "260.00",
        "unit_name": "KG",
        "unit_price": "74000.00",
        "discount": "0.00",
        "amount": "19240000.00"
      }
    ]
  }
}
```

### 4. Get Summary Statistics

Get summary per cabang.

**Endpoint:** `GET /api/sales-invoices/summary/stats`

**Query Parameters:**
- `branchId` (optional) - Filter by branch
- `dateFrom` (optional) - Filter by date range
- `dateTo` (optional) - Filter by date range

**Example:**
```bash
# Summary all branches
curl "http://localhost:3000/api/sales-invoices/summary/stats"

# Summary specific branch
curl "http://localhost:3000/api/sales-invoices/summary/stats?branchId=branch-1"

# Summary by date range
curl "http://localhost:3000/api/sales-invoices/summary/stats?dateFrom=2025-11-01&dateTo=2025-11-30"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "branch_id": "branch-1",
      "branch_name": "Cabang 1 - Semarang",
      "invoice_count": "150",
      "total_sales": "450000000.00",
      "avg_invoice": "3000000.00",
      "first_date": "2025-11-01",
      "last_date": "2025-11-30"
    },
    {
      "branch_id": "branch-2",
      "branch_name": "Cabang Cikarang Utara",
      "invoice_count": "120",
      "total_sales": "380000000.00",
      "avg_invoice": "3166666.67",
      "first_date": "2025-11-01",
      "last_date": "2025-11-30"
    }
  ]
}
```

## Usage Examples

### Scenario 1: Daily Sync

Sync data harian untuk semua cabang:

```bash
# Branch 1
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-20&dateTo=2025-11-20"

# Branch 2
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-2&dateFrom=2025-11-20&dateTo=2025-11-20"

# Branch 3
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-3&dateFrom=2025-11-20&dateTo=2025-11-20"
```

### Scenario 2: Monthly Report

Get laporan bulanan:

```bash
# Get all invoices for November 2025
curl "http://localhost:3000/api/sales-invoices?dateFrom=2025-11-01&dateTo=2025-11-30&limit=1000"

# Get summary per branch
curl "http://localhost:3000/api/sales-invoices/summary/stats?dateFrom=2025-11-01&dateTo=2025-11-30"
```

### Scenario 3: Customer Analysis

Analisa per customer:

```bash
# Get all invoices for specific customer
curl "http://localhost:3000/api/sales-invoices?customerId=C.00054&limit=100"
```

## Database Queries

### Direct SQL Queries

```sql
-- Top 10 customers by sales
SELECT 
  customer_name,
  COUNT(*) as invoice_count,
  SUM(total) as total_sales
FROM sales_invoices
WHERE trans_date >= '2025-11-01'
GROUP BY customer_name
ORDER BY total_sales DESC
LIMIT 10;

-- Sales by branch
SELECT 
  branch_name,
  COUNT(*) as invoices,
  SUM(total) as total
FROM sales_invoices
WHERE trans_date >= '2025-11-01'
GROUP BY branch_name;

-- Top selling items
SELECT 
  item_no,
  item_name,
  SUM(quantity) as total_qty,
  SUM(amount) as total_amount
FROM sales_invoice_items
GROUP BY item_no, item_name
ORDER BY total_amount DESC
LIMIT 20;

-- Daily sales trend
SELECT 
  trans_date,
  COUNT(*) as invoice_count,
  SUM(total) as daily_sales
FROM sales_invoices
WHERE trans_date >= '2025-11-01'
GROUP BY trans_date
ORDER BY trans_date;
```

## Performance

### Indexes

Sudah dibuat indexes untuk:
- `branch_id, trans_date` - Filter by branch & date
- `customer_id` - Filter by customer
- `invoice_number` - Search by invoice number
- `item_no` - Search by item

### Query Performance

- List invoices: ~10ms (with index)
- Get detail: ~5ms
- Summary: ~20ms
- Sync 100 invoices: ~30-60 seconds (depends on Accurate API)

### Optimization Tips

1. **Use date filters** - Always filter by date range
2. **Pagination** - Use limit & offset for large results
3. **Indexes** - Already optimized
4. **Connection pool** - Max 20 connections configured

## Error Handling

### Common Errors

**400 Bad Request**
```json
{
  "error": "branchId is required"
}
```

**404 Not Found**
```json
{
  "error": "Branch not found"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error",
  "message": "Connection timeout"
}
```

## Next Steps

1. ✅ Sync data dari Accurate API
2. ✅ Query dari PostgreSQL
3. 🔄 Setup scheduler untuk auto-sync
4. 🔄 Export to CSV
5. 🔄 Dashboard/Analytics

---

**Database:** PostgreSQL  
**Tables:** sales_invoices, sales_invoice_items  
**Performance:** Optimized with indexes
