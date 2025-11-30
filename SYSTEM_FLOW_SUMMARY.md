# System Flow Summary - Accurate API Integration

## Tech Stack
- **Backend:** Node.js + Fastify
- **Database:** PostgreSQL
- **External API:** Accurate Online API

---

## Multi-Branch Configuration
- **14 Cabang** terdaftar di `backend/config/branches.json`
- Setiap cabang memiliki:
  - `id` - Identifier cabang (branch-1, branch-2, dst)
  - `name` - Nama cabang (Soepomo, Cikarang Utara, dst)
  - `dbId` - Database ID di Accurate
  - `credentials` - appKey, signatureSecret, clientId

---

## Authentication Flow
```
1. Generate timestamp (ISO format)
2. Create HMAC-SHA256 signature: HMAC(timestamp, signatureSecret)
3. Headers:
   - Authorization: Bearer {clientId}
   - X-API-Timestamp: {timestamp}
   - X-Api-Signature: {signature}
   - X-Session-ID: {dbId}
```

---

## Data Fetching Methods

### Method A: Generic Data Fetch (Simple Cache)
**Endpoint:** `GET /api/data/:endpoint`

**Flow:**
```
Client Request
    ↓
Controller (accurateController.js)
    ↓
Service (accurateService.js) → Accurate API
    ↓
Cache Model (cacheModel.js) → PostgreSQL
    ↓
Save to: accurate_data table (JSONB)
```

**Use Case:** Quick cache, flexible data structure

**Table:** `accurate_data`
- endpoint (VARCHAR)
- cabang_id (VARCHAR)
- data (JSONB)
- created_at, updated_at (TIMESTAMP)

---

### Method B: Structured Sales Invoice Sync
**Endpoint:** `POST /api/sales-invoices/sync`

**Flow:**
```
1. FETCH LIST (with pagination)
   ├─ Request: sales-invoice/list.do
   ├─ Filter: date range (createdDate/transDate/modifiedDate)
   ├─ Pagination: Auto-fetch all pages (1000 rows/page)
   └─ Result: Array of invoice IDs

2. FETCH DETAILS (with batching)
   ├─ Batch size: 50 items (configurable)
   ├─ Batch delay: 300ms (configurable)
   ├─ Parallel: Promise.all per batch
   └─ Result: Full invoice details

3. TRANSFORM & SAVE
   ├─ Parse invoice header → sales_invoices
   ├─ Parse invoice items → sales_invoice_items
   ├─ Convert date: DD/MM/YYYY → YYYY-MM-DD
   └─ Handle relationships (foreign keys)

4. RETURN SUMMARY
   └─ Fetched, saved, errors count
```

**Use Case:** Structured reporting, analytics, complex queries

**Tables:**
- `sales_invoices` - Invoice headers (normalized)
  - invoice_id, invoice_number, branch_id, branch_name
  - trans_date, customer_id, customer_name
  - salesman_id, warehouse_id
  - subtotal, discount, tax, total
  - raw_data (JSONB backup)

- `sales_invoice_items` - Line items
  - invoice_id (FK), branch_id
  - item_no, item_name, quantity
  - unit_name, unit_price, discount, amount

---

## Database Schema

### Tables
1. **sales_invoices** - Structured invoice headers
2. **sales_invoice_items** - Structured invoice items
3. **accurate_data** - Generic JSONB cache
4. **api_logs** - API call logging

### Indexes (Performance)
- `idx_branch_date` - (branch_id, trans_date)
- `idx_customer` - (customer_id)
- `idx_invoice_number` - (invoice_number)
- `idx_invoice_items` - (invoice_id)
- `idx_item_no` - (item_no)

---

## API Endpoints

### Branch Management
- `GET /api/branches` - List all active branches
- `GET /api/databases` - Get database list from Accurate

### Generic Data
- `GET /api/data/:endpoint` - Fetch & cache any endpoint
- `GET /api/cache/:endpoint` - Get cached data
- `GET /api/details/:endpoint` - Fetch list with all details

### Sales Invoices (Structured)
- `POST /api/sales-invoices/sync` - Sync from Accurate to PostgreSQL
- `GET /api/sales-invoices` - Query invoices from database
- `GET /api/sales-invoices/:id` - Get invoice detail by ID
- `GET /api/sales-invoices/summary/stats` - Get summary statistics

---

## Query Parameters

### Sync Parameters
- `branchId` (required) - Branch identifier
- `dateFrom` - Start date (YYYY-MM-DD)
- `dateTo` - End date (YYYY-MM-DD)
- `dateFilterType` - createdDate | transDate | modifiedDate
- `maxItems` - Limit items to fetch
- `batchSize` - Items per batch (default: 50)
- `batchDelay` - Delay between batches in ms (default: 300)

### Query Parameters
- `branchId` - Filter by branch
- `dateFrom`, `dateTo` - Date range filter
- `customerId` - Filter by customer
- `limit`, `offset` - Pagination

---

## Performance Optimization

### Batching Strategy
- Default: 50 items per batch
- Delay: 300ms between batches
- Parallel processing within batch using Promise.all
- Error handling per item (continue on failure)

### Pagination Handling
- Auto-detect total pages from API response
- Fetch all pages automatically
- Small delay (100ms) between pages

### Database Optimization
- Upsert logic (check → update or insert)
- Indexes on frequently queried columns
- JSONB for flexible data storage
- Foreign key constraints for data integrity

---

## Current Status (Session Sebelumnya)

**Cabang Cikarang Utara:**
- Database ID: `1234567`
- Data tersimpan: 1 record
- Size: 438 kB
- Last update: 2025-11-30 09:19:10
- Table: `accurate_data` (generic cache)

---

## Recommendations

### For Reporting & Analytics
Use Method B (Structured Sync):
```bash
POST /api/sales-invoices/sync?branchId=branch-2&dateFrom=2025-11-01&dateTo=2025-11-30
```

### For Quick Data Access
Use Method A (Generic Cache):
```bash
GET /api/data/customer/list?dbId=1234567&branchId=branch-2
```

### For Multi-Branch Sync
Loop through all branches:
```javascript
const branches = ['branch-1', 'branch-2', ...];
for (const branchId of branches) {
  await syncSalesInvoices(branchId, dateFrom, dateTo);
}
```
