# Goods Implementation Setup Guide

## Overview
This guide explains how the Goods (Barang) module was implemented following the same pattern as Purchase Invoice with header and detail tables.

## Files Created

### 1. Database Migration
**File:** `backend/migrations/create_goods_tables.sql`

Contains SQL schema for:
- `goods` - Header table with product information
- `goods_warehouse_details` - Warehouse-specific stock details
- `goods_selling_prices` - Selling price information by category/branch
- Indexes for performance
- Trigger for automatic updated_at timestamp

### 2. Database Model
**File:** `backend/models/goodsModel.js`

Provides database operations:
- `create(goodsData, warehouseDetails, sellingPrices)` - Insert/update goods with transaction
- `getById(id)` - Get goods with all details
- `getExistingForSync()` - Get lightweight list for sync check
- `list(filters)` - List goods with filters
- `getSummary(filters)` - Get statistics by type
- `getWarehouseSummary(filters)` - Get statistics by warehouse
- `delete(id)` - Delete goods

### 3. API Controller
**File:** `backend/controllers/goodsController.js`

Implements endpoints:
- `checkSyncStatus()` - Compare API vs DB
- `count()` - Count goods in DB
- `sync()` - Sync all goods from API
- `getAll()` - List goods with filters
- `getById()` - Get goods detail
- `getSummary()` - Get statistics

### 4. API Routes
**File:** `backend/routes/api.js` (updated)

Added 6 new routes:
- `GET /api/goods/check-sync` - Check sync status
- `GET /api/goods/count` - Count goods
- `POST /api/goods/sync` - Sync goods
- `GET /api/goods` - List goods
- `GET /api/goods/:id` - Get goods detail
- `GET /api/goods/summary/stats` - Get statistics

### 5. Database Initialization
**File:** `backend/config/database.js` (updated)

Added table creation in `initialize()` function:
- Creates goods table
- Creates goods_warehouse_details table
- Creates goods_selling_prices table
- Creates all indexes
- Creates trigger for updated_at

## Database Schema

### goods (Header Table)
```sql
CREATE TABLE goods (
  id SERIAL PRIMARY KEY,
  goods_id BIGINT UNIQUE NOT NULL,
  goods_no VARCHAR(50) NOT NULL,
  goods_name VARCHAR(255) NOT NULL,
  short_name VARCHAR(255),
  category_id VARCHAR(50),
  category_name VARCHAR(255),
  unit1_id VARCHAR(50),
  unit1_name VARCHAR(50),
  unit1_price DECIMAL(15,2),
  cost DECIMAL(15,2),
  unit_price DECIMAL(15,2),
  item_type VARCHAR(50),
  suspended BOOLEAN,
  opt_lock INTEGER,
  raw_data JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### goods_warehouse_details (Detail Table)
```sql
CREATE TABLE goods_warehouse_details (
  id SERIAL PRIMARY KEY,
  goods_id BIGINT NOT NULL,
  warehouse_id VARCHAR(50),
  warehouse_name VARCHAR(255),
  location_id VARCHAR(50),
  unit1_quantity DECIMAL(15,2),
  balance DECIMAL(15,2),
  balance_unit VARCHAR(50),
  default_warehouse BOOLEAN,
  scrap_warehouse BOOLEAN,
  suspended BOOLEAN,
  description TEXT,
  pic VARCHAR(255),
  opt_lock INTEGER,
  created_at TIMESTAMP,
  FOREIGN KEY (goods_id) REFERENCES goods(goods_id)
);
```

### goods_selling_prices (Detail Table)
```sql
CREATE TABLE goods_selling_prices (
  id SERIAL PRIMARY KEY,
  goods_id BIGINT NOT NULL,
  unit_id VARCHAR(50),
  unit_name VARCHAR(50),
  price DECIMAL(15,2),
  price_category_id VARCHAR(50),
  price_category_name VARCHAR(255),
  currency_code VARCHAR(10),
  currency_symbol VARCHAR(10),
  branch_id VARCHAR(50),
  branch_name VARCHAR(255),
  effective_date DATE,
  opt_lock INTEGER,
  created_at TIMESTAMP,
  FOREIGN KEY (goods_id) REFERENCES goods(goods_id)
);
```

## Data Flow

### Sync Process
1. **Check Sync Status**
   - Fetch list from Accurate API
   - Compare with database using `goods_id` and `opt_lock`
   - Categorize as: new, updated, unchanged

2. **Sync Goods**
   - Fetch all goods with details from API
   - Process in batches (default 50)
   - For each good:
     - Extract header data
     - Extract warehouse details
     - Extract selling prices
     - Save to database with transaction

3. **Transaction Handling**
   - BEGIN transaction
   - Insert/update goods header
   - Delete existing warehouse details
   - Insert new warehouse details
   - Delete existing selling prices
   - Insert new selling prices
   - COMMIT

### Data Transformation

**From Accurate API:**
```javascript
{
  id: 2101,
  no: "SAPI-SNJ-563",
  name: "*S* RIB END MEAT SWIFT",
  shortName: "*S* RIB END MEAT SWIFT",
  itemCategory: { id: 52, name: "DAGING SAPI" },
  unit1: { id: 100, name: "KG" },
  unit1Price: 70000,
  cost: 0,
  unitPrice: 70000,
  itemType: "INVENTORY",
  suspended: true,
  optLock: 3,
  detailWarehouseData: [
    {
      id: 50,
      warehouseName: "CIKARANG UTARA",
      locationId: 52,
      unit1Quantity: 0,
      balance: 0,
      balanceUnit: "0 KG",
      defaultWarehouse: true,
      scrapWarehouse: false,
      suspended: false,
      optLock: 3
    }
  ],
  detailSellingPrice: [
    {
      unit: { id: 100, name: "KG" },
      price: 70000,
      priceCategory: { id: 50, name: "Umum" },
      currency: { code: "IDR", symbol: "Rp" },
      branch: { id: 50, name: "Kantor Pusat" },
      effectiveDate: "10 Jun 2023",
      optLock: 0
    }
  ]
}
```

**To Database:**
```javascript
// goods table
{
  goods_id: 2101,
  goods_no: "SAPI-SNJ-563",
  goods_name: "*S* RIB END MEAT SWIFT",
  short_name: "*S* RIB END MEAT SWIFT",
  category_id: "52",
  category_name: "DAGING SAPI",
  unit1_id: "100",
  unit1_name: "KG",
  unit1_price: 70000,
  cost: 0,
  unit_price: 70000,
  item_type: "INVENTORY",
  suspended: true,
  opt_lock: 3,
  raw_data: { ... }
}

// goods_warehouse_details table
{
  goods_id: 2101,
  warehouse_id: "50",
  warehouse_name: "CIKARANG UTARA",
  location_id: "52",
  unit1_quantity: 0,
  balance: 0,
  balance_unit: "0 KG",
  default_warehouse: true,
  scrap_warehouse: false,
  suspended: false,
  opt_lock: 3
}

// goods_selling_prices table
{
  goods_id: 2101,
  unit_id: "100",
  unit_name: "KG",
  price: 70000,
  price_category_id: "50",
  price_category_name: "Umum",
  currency_code: "IDR",
  currency_symbol: "Rp",
  branch_id: "50",
  branch_name: "Kantor Pusat",
  effective_date: "2023-06-10",
  opt_lock: 0
}
```

## API Endpoints

### 1. Check Sync Status
```
GET /api/goods/check-sync?branchId=50
```
Compares goods in Accurate with database.

### 2. Count Goods
```
GET /api/goods/count
```
Returns total count of goods in database.

### 3. Sync Goods
```
POST /api/goods/sync
{
  "branchId": "50",
  "batchSize": 50,
  "delayMs": 100,
  "streamInsert": false
}
```
Syncs all goods from Accurate to database.

### 4. List Goods
```
GET /api/goods?category_id=52&suspended=false&limit=20&offset=0
```
Lists goods with optional filters.

### 5. Get Goods Detail
```
GET /api/goods/1
```
Gets specific goods with warehouse details and selling prices.

### 6. Get Summary
```
GET /api/goods/summary/stats?category_id=52
```
Gets statistics by type and warehouse.

## Implementation Steps

### Step 1: Database Setup
The tables are automatically created when the backend starts:
- `backend/config/database.js` calls `initialize()` on startup
- All tables, indexes, and triggers are created if they don't exist

### Step 2: API Routes
Routes are automatically registered when the backend starts:
- `backend/routes/api.js` imports `goodsController`
- All 6 endpoints are registered with Fastify

### Step 3: Testing

**Check sync status:**
```bash
curl -X GET "http://localhost:3000/api/goods/check-sync?branchId=50"
```

**Sync goods:**
```bash
curl -X POST "http://localhost:3000/api/goods/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "50",
    "batchSize": 50,
    "delayMs": 100
  }'
```

**List goods:**
```bash
curl -X GET "http://localhost:3000/api/goods?limit=10"
```

**Get goods detail:**
```bash
curl -X GET "http://localhost:3000/api/goods/1"
```

## Key Features

1. **Header + Detail Structure**
   - goods (header)
   - goods_warehouse_details (warehouse stock)
   - goods_selling_prices (pricing)

2. **Sync Detection**
   - Uses `goods_id` as unique identifier
   - Uses `opt_lock` for change detection
   - Compares API vs database

3. **Batch Processing**
   - Configurable batch size (default 50)
   - Configurable delay between batches (default 100ms)
   - Prevents API overload

4. **Transaction Support**
   - All operations in single transaction
   - Rollback on error
   - Data consistency guaranteed

5. **Error Handling**
   - Try-catch blocks
   - Detailed error messages
   - Continues on item errors

6. **Performance**
   - Indexes on key columns
   - Pagination support
   - Lightweight sync check query

7. **Flexibility**
   - Multiple filter options
   - Search by goods_no or goods_name
   - Statistics by type and warehouse

## Comparison with Purchase Invoice

| Feature | Purchase Invoice | Goods |
|---------|------------------|-------|
| Header Table | purchase_invoices | goods |
| Detail Table 1 | purchase_invoice_items | goods_warehouse_details |
| Detail Table 2 | - | goods_selling_prices |
| Sync Check | ✅ | ✅ |
| Batch Processing | ✅ | ✅ |
| Transaction Support | ✅ | ✅ |
| Error Handling | ✅ | ✅ |
| Pagination | ✅ | ✅ |
| Statistics | ✅ | ✅ |

## Notes

- All timestamps are in UTC
- Raw API data is stored in JSONB for audit trail
- Optimistic locking prevents sync conflicts
- Warehouse details can be multiple per good
- Selling prices can be multiple per good
- Suspended status tracks active/inactive goods
