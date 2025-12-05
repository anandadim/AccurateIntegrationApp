# Goods vs Purchase Invoice - Implementation Comparison

## Overview
Both Goods and Purchase Invoice follow the same architectural pattern with header and detail tables. This document compares their implementations to show consistency and differences.

## Architecture Comparison

### Table Structure

#### Purchase Invoice
```
purchase_invoices (header)
    ├── purchase_invoice_items (detail)
```

#### Goods
```
goods (header)
    ├── goods_warehouse_details (detail)
    └── goods_selling_prices (detail)
```

**Key Difference:** Goods has 2 detail tables vs Purchase Invoice has 1 detail table.

## Database Schema Comparison

### Header Tables

| Aspect | Purchase Invoice | Goods |
|--------|------------------|-------|
| Primary Key | id (SERIAL) | id (SERIAL) |
| Unique ID | invoice_id (BIGINT) | goods_id (BIGINT) |
| Number Field | invoice_number | goods_no |
| Name Field | - | goods_name |
| Category | - | category_id, category_name |
| Unit Info | - | unit1_id, unit1_name, unit1_price |
| Pricing | subtotal, discount, tax, total | cost, unit_price |
| Status | status_name | item_type, suspended |
| Branch | branch_id, branch_name | - |
| Vendor | vendor_no, vendor_name | - |
| Warehouse | warehouse_id, warehouse_name | - |
| Metadata | opt_lock, raw_data | opt_lock, raw_data |
| Timestamps | created_at, updated_at | created_at, updated_at |

### Detail Tables

#### Purchase Invoice Items
| Column | Type | Purpose |
|--------|------|---------|
| invoice_id | BIGINT FK | Link to header |
| item_no | VARCHAR | Item code |
| item_name | VARCHAR | Item name |
| quantity | DECIMAL | Qty ordered |
| unit_price | DECIMAL | Price per unit |
| discount | DECIMAL | Line discount |
| amount | DECIMAL | Line total |
| warehouse_name | VARCHAR | Warehouse |
| item_category | VARCHAR | Category |

#### Goods Warehouse Details
| Column | Type | Purpose |
|--------|------|---------|
| goods_id | BIGINT FK | Link to header |
| warehouse_id | VARCHAR | Warehouse ID |
| warehouse_name | VARCHAR | Warehouse name |
| unit1_quantity | DECIMAL | Stock quantity |
| balance | DECIMAL | Current balance |
| default_warehouse | BOOLEAN | Is default |
| scrap_warehouse | BOOLEAN | Is scrap |
| suspended | BOOLEAN | Status |

#### Goods Selling Prices
| Column | Type | Purpose |
|--------|------|---------|
| goods_id | BIGINT FK | Link to header |
| unit_id | VARCHAR | Unit ID |
| price | DECIMAL | Selling price |
| price_category_id | VARCHAR | Category ID |
| currency_code | VARCHAR | Currency |
| branch_id | VARCHAR | Branch |
| effective_date | DATE | Valid from |

## Model Layer Comparison

### Purchase Invoice Model Methods
```javascript
create(invoiceData, items)
getById(id)
getExistingForSync(branchId, dateFrom, dateTo)
list(filters)
getSummary(filters)
delete(id)
```

### Goods Model Methods
```javascript
create(goodsData, warehouseDetails, sellingPrices)
getById(id)
getExistingForSync()
list(filters)
getSummary(filters)
getWarehouseSummary(filters)
delete(id)
```

**Differences:**
- Goods `create()` takes 3 parameters vs Purchase Invoice 2
- Goods has `getWarehouseSummary()` method
- Purchase Invoice `getExistingForSync()` takes date filters
- Goods `getExistingForSync()` takes no parameters

## Controller Layer Comparison

### Purchase Invoice Endpoints
```
GET  /api/purchase-invoices/check-sync
GET  /api/purchase-invoices/count
POST /api/purchase-invoices/sync
GET  /api/purchase-invoices
GET  /api/purchase-invoices/:id
GET  /api/purchase-invoices/summary/stats
```

### Goods Endpoints
```
GET  /api/goods/check-sync
GET  /api/goods/count
POST /api/goods/sync
GET  /api/goods
GET  /api/goods/:id
GET  /api/goods/summary/stats
```

**Similarities:** Same endpoint structure and naming pattern

## API Response Comparison

### Check Sync Status Response

**Purchase Invoice:**
```json
{
  "summary": {
    "total": 1500,
    "new": 45,
    "updated": 12,
    "unchanged": 1443,
    "needSync": 57,
    "inDatabase": 1455
  },
  "invoices": {
    "new": [...],
    "updated": [...]
  }
}
```

**Goods:**
```json
{
  "summary": {
    "total": 1500,
    "new": 45,
    "updated": 12,
    "unchanged": 1443,
    "needSync": 57,
    "inDatabase": 1455
  },
  "goods": {
    "new": [...],
    "updated": [...]
  }
}
```

**Difference:** Field name `invoices` vs `goods` (entity-specific)

### Sync Request Body

**Purchase Invoice:**
```json
{
  "branchId": "50",
  "dateFrom": "2024-01-01",
  "dateTo": "2024-12-31",
  "dateFilterType": "createdDate",
  "batchSize": 50,
  "delayMs": 100,
  "streamInsert": false
}
```

**Goods:**
```json
{
  "branchId": "50",
  "batchSize": 50,
  "delayMs": 100,
  "streamInsert": false
}
```

**Difference:** Goods doesn't need date filters (syncs all goods)

## Data Transformation Comparison

### Purchase Invoice Transformation
```
Accurate API
    ↓
purchaseInvoiceController.syncFromAccurate()
    ↓
Extract: header, items
    ↓
purchaseInvoiceModel.create()
    ↓
Database: purchase_invoices, purchase_invoice_items
```

### Goods Transformation
```
Accurate API
    ↓
goodsController.sync()
    ↓
Extract: header, warehouse details, selling prices
    ↓
goodsModel.create()
    ↓
Database: goods, goods_warehouse_details, goods_selling_prices
```

## Sync Detection Comparison

### Purchase Invoice
- Uses `invoice_id` as unique identifier
- Uses `optLock` for change detection
- Date range filtering for targeted sync
- Compares: new, updated, unchanged

### Goods
- Uses `goods_id` as unique identifier
- Uses `optLock` for change detection
- No date filtering (syncs all)
- Compares: new, updated, unchanged

## Transaction Handling Comparison

### Purchase Invoice
```javascript
BEGIN
  INSERT/UPDATE purchase_invoices header
  DELETE purchase_invoice_items (old)
  INSERT purchase_invoice_items (new)
COMMIT
```

### Goods
```javascript
BEGIN
  INSERT/UPDATE goods header
  DELETE goods_warehouse_details (old)
  INSERT goods_warehouse_details (new)
  DELETE goods_selling_prices (old)
  INSERT goods_selling_prices (new)
COMMIT
```

**Difference:** Goods has 2 detail table operations vs Purchase Invoice 1

## Error Handling Comparison

Both implementations have similar error handling:
- Parameter validation
- Branch existence check
- Try-catch blocks
- Rollback on error
- Detailed error messages
- Logging

## Logging Comparison

### Purchase Invoice Logging
```
🔍 Checking sync status for {branch}...
📅 Date Filter: {filterType, from, to}
📊 API Pagination: {rowCount, pageSize}
📄 Calculated: {totalPages}
📊 API: {count} invoices
💾 DB: {count} invoices
✅ Check complete: {new}, {updated}, {unchanged}
```

### Goods Logging
```
🔍 Checking goods sync status for {branch}...
📊 API Pagination: {rowCount, pageSize}
📄 Calculated: {totalPages}
📊 API: {count} items
💾 DB: {count} items
✅ Check complete: {new}, {updated}, {unchanged}
```

**Difference:** Goods logging is simpler (no date filter info)

## Performance Considerations

### Purchase Invoice
- Indexes on: branch_id, trans_date, vendor_no, status_name, invoice_number
- Date range filtering reduces data
- Pagination support

### Goods
- Indexes on: goods_no, category_id, item_type, suspended, warehouse_id
- No date filtering (syncs all)
- Pagination support

**Difference:** Goods has more category-based indexes

## Feature Comparison

| Feature | Purchase Invoice | Goods |
|---------|------------------|-------|
| Header Table | ✅ | ✅ |
| Detail Tables | 1 | 2 |
| Sync Detection | ✅ | ✅ |
| Date Filtering | ✅ | ❌ |
| Batch Processing | ✅ | ✅ |
| Transaction Support | ✅ | ✅ |
| Error Handling | ✅ | ✅ |
| Pagination | ✅ | ✅ |
| Statistics | ✅ | ✅ |
| Warehouse Summary | ❌ | ✅ |
| Category Filtering | ❌ | ✅ |
| Type Filtering | ❌ | ✅ |

## Code Structure Comparison

### File Organization

**Purchase Invoice:**
```
backend/
  migrations/
    create_purchase_invoices_tables.sql
  models/
    purchaseInvoiceModel.js
  controllers/
    purchaseInvoiceController.js
  routes/
    api.js (updated)
  config/
    database.js (updated)
```

**Goods:**
```
backend/
  migrations/
    create_goods_tables.sql
  models/
    goodsModel.js
  controllers/
    goodsController.js
  routes/
    api.js (updated)
  config/
    database.js (updated)
```

**Similarity:** Identical file structure and organization

## Naming Conventions Comparison

### Purchase Invoice
- Table: `purchase_invoices`, `purchase_invoice_items`
- Model: `purchaseInvoiceModel`
- Controller: `purchaseInvoiceController`
- Routes: `/api/purchase-invoices`

### Goods
- Table: `goods`, `goods_warehouse_details`, `goods_selling_prices`
- Model: `goodsModel`
- Controller: `goodsController`
- Routes: `/api/goods`

**Pattern:** Consistent naming convention for both

## Testing Comparison

### Purchase Invoice Tests
- Check sync with date range
- Sync with specific dates
- Filter by vendor
- Filter by branch
- Pagination

### Goods Tests
- Check sync (no date range)
- Sync all goods
- Filter by category
- Filter by type
- Filter by warehouse
- Pagination

## Documentation Comparison

### Purchase Invoice Docs
- PURCHASE_INVOICE_API.md
- PURCHASE_INVOICE_SETUP.md
- PURCHASE_INVOICE_CHECKLIST.md
- PURCHASE_INVOICE_SUMMARY.md
- PURCHASE_VS_SALES_COMPARISON.md
- FRONTEND_PURCHASE_INVOICE_GUIDE.md

### Goods Docs
- GOODS_API.md
- GOODS_SETUP.md
- GOODS_CHECKLIST.md
- GOODS_VS_PURCHASE_COMPARISON.md (this file)

**Difference:** Goods docs are more concise, focused on core functionality

## Summary

### Similarities
- ✅ Same architectural pattern (header + detail)
- ✅ Same sync detection mechanism
- ✅ Same batch processing approach
- ✅ Same transaction handling
- ✅ Same error handling
- ✅ Same file organization
- ✅ Same naming conventions
- ✅ Same API endpoint structure

### Differences
- ❌ Goods has 2 detail tables vs Purchase Invoice 1
- ❌ Goods doesn't use date filtering
- ❌ Goods has warehouse summary stats
- ❌ Purchase Invoice has date-based filtering
- ❌ Different detail table purposes

### Conclusion
The implementations are highly consistent, following the same design patterns and conventions. Differences are due to the nature of the data (invoices vs products) rather than architectural choices.

## Migration Path

If you need to implement similar modules in the future, follow this pattern:

1. **Database Schema**
   - Create header table with unique ID and opt_lock
   - Create detail tables as needed
   - Add indexes for performance
   - Add trigger for updated_at

2. **Model Layer**
   - Implement CRUD operations
   - Use transactions for consistency
   - Implement getExistingForSync()
   - Implement getSummary()

3. **Controller Layer**
   - Implement checkSyncStatus()
   - Implement sync()
   - Implement getAll()
   - Implement getById()
   - Implement getSummary()

4. **Routes**
   - Add 6 standard endpoints
   - Follow naming conventions
   - Register with Fastify

5. **Documentation**
   - Create API documentation
   - Create setup guide
   - Create checklist
   - Create comparison guide

This pattern ensures consistency across all modules.
