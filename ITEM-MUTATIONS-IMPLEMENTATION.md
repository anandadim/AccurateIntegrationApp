# Item Mutations Implementation Summary

## Overview
Implementation of item-mutations endpoint with single table approach - all data stored in one table with raw_data JSONB field containing complete API response.

## Files Created

### 1. Backend Model
**File**: `backend/models/itemMutationsModel.js`

**Features**:
- `create(mutationData)` - Insert mutation with all data in raw_data
- `getById(id)` - Get mutation by ID
- `getExistingForSync()` - Lightweight sync check (returns mutation_id, mutation_number, opt_lock)
- `list()` - Filtered query with pagination
- `getSummary()` - Statistics by branch and mutation type
- `delete()` - Delete mutation

**Database Table**:
- `item_mutations` - Single table with all mutation data

### 2. Backend Controller
**File**: `backend/controllers/itemMutationsController.js`

**Endpoints**:
- `GET /item-mutations/check-sync` - Compare API vs Database status
- `GET /item-mutations/count` - Count mutations without fetching details (dry-run)
- `POST /item-mutations/sync` - Full sync from Accurate API
- `POST /item-mutations/sync-smart` - Smart sync (only new + updated)
- `GET /item-mutations` - Query mutations from database
- `GET /item-mutations/:id` - Get mutation detail by ID
- `GET /item-mutations/summary/stats` - Summary statistics

**Key Methods**:
- `checkSyncStatus()` - Categorize as new/updated/unchanged based on optLock
- `syncFromAccurate()` - Full sync with streaming support
- `syncSmart()` - Intelligent sync with retry logic
- `_saveBatch()` - Helper to save batch data to database

### 3. API Routes
**File**: `backend/routes/api.js`

Added routes for item-mutations endpoints (lines 230-251).

### 4. Database Schema
**File**: `backend/config/database.js`

Added single table (lines 1021-1069):
- `item_mutations` - Complete mutation data with indexes
- Trigger for auto-updating `updated_at` timestamp

## Data Structure

### Single Table Fields
- `id` - Auto-increment primary key
- `mutation_id` - Unique ID from Accurate
- `mutation_number` - Document number
- `branch_id` - Branch identifier
- `branch_name` - Branch name
- `trans_date` - Transaction date
- `mutation_type` - Type of mutation (ADJUSTMENT, TRANSFER, etc.)
- `warehouse_id` - Warehouse ID
- `warehouse_name` - Warehouse name
- `total_quantity` - Total quantity
- `total_value` - Total value
- `raw_data` - Complete JSON from API (includes detailItem array)
- `opt_lock` - Version tracking for sync
- `created_at` - Creation timestamp
- `updated_at` - Update timestamp

### Raw Data Structure
The `raw_data` JSONB field contains the complete API response including:
- All header fields
- `detailItem` array with all mutation line items
- All nested objects (customer, warehouse, items, etc.)

Accessing detail items from raw_data:
```sql
SELECT raw_data->'detailItem' FROM item_mutations WHERE id = 1;
```

## Usage Examples

### Check Sync Status
```bash
GET /item-mutations/check-sync?branchId=50&dateFrom=2025-01-01&dateTo=2025-01-31
```

### Count Mutations (Dry Run)
```bash
GET /item-mutations/count?branchId=50&dateFrom=2025-01-01&dateTo=2025-01-31
```

### Full Sync
```bash
POST /item-mutations/sync?branchId=50&dateFrom=2025-01-01&dateTo=2025-01-31&batchSize=50&batchDelay=300&streamInsert=true
```

### Smart Sync (Only New + Updated)
```bash
POST /item-mutations/sync-smart?branchId=50&dateFrom=2025-01-01&dateTo=2025-01-31&mode=missing
```

### Query Mutations
```bash
GET /item-mutations?branchId=50&dateFrom=2025-01-01&dateTo=2025-01-31&mutationType=ADJUSTMENT&limit=100
```

### Get Mutation Detail
```bash
GET /item-mutations/:id
```

### Get Summary Statistics
```bash
GET /item-mutations/summary/stats?branchId=50&dateFrom=2025-01-01&dateTo=2025-01-31
```

## Architecture Pattern

Following the same pattern as sales-invoice:

1. **Service Layer** (`accurateService.js`) - Generic, works with any endpoint
2. **Model Layer** (`itemMutationsModel.js`) - Database operations
3. **Controller Layer** (`itemMutationsController.js`) - Business logic
4. **Routes** (`api.js`) - API endpoints
5. **Database** (`database.js`) - Table definitions

## Key Features

### Single Table Design
- All data stored in one table
- Complete API response in `raw_data` JSONB field
- Simplified queries and joins
- Easy access to nested data via JSONB operators

### Smart Sync
- Compares API vs Database using `optLock` field
- Only syncs new or updated mutations
- Reduces API calls and database writes
- Supports retry logic for transient errors

### Batch Processing
- Configurable batch size (default: 50)
- Configurable delay between batches (default: 300ms)
- Streaming insert mode for better performance
- Progress indicators

### Error Handling
- Retry logic for JDBC connection errors
- Retry logic for 502 Bad Gateway
- Detailed error logging
- Error summary reporting

### Performance
- Indexes on frequently queried fields
- Pagination support
- Lightweight sync check queries
- Bulk insert with transactions
- JSONB indexing support available

## JSONB Query Examples

### Query detail items
```sql
SELECT
  mutation_number,
  jsonb_array_elements(raw_data->'detailItem') as detail
FROM item_mutations
WHERE branch_id = '50';
```

### Count items per mutation
```sql
SELECT
  mutation_number,
  jsonb_array_length(raw_data->'detailItem') as item_count
FROM item_mutations
WHERE branch_id = '50';
```

### Search by item name in details
```sql
SELECT *
FROM item_mutations
WHERE raw_data->'detailItem' @> '[{"item": {"name": "Item Name"}}]';
```

### Get total quantity from details
```sql
SELECT
  mutation_number,
  (SELECT SUM((detail->>'quantity')::decimal)
   FROM jsonb_array_elements(raw_data->'detailItem') as detail) as total_qty
FROM item_mutations
WHERE branch_id = '50';
```

## Next Steps

1. **Test the implementation**:
   - Start the backend server
   - Initialize database tables (automatic on startup)
   - Test check-sync endpoint
   - Test sync-smart endpoint
   - Verify data in database

2. **Monitor performance**:
   - Check API call counts
   - Monitor database query performance
   - Adjust batch size and delay as needed

3. **Optional enhancements**:
   - Add scheduler for automatic sync
   - Add webhook support for real-time updates
   - Add data validation rules
   - Add export functionality

## Notes

- The `accurateService.js` is already generic and supports any endpoint, so no changes were needed
- The implementation follows the exact same pattern as sales-invoice for consistency
- All endpoints support the same query parameters for filtering and pagination
- The raw_data field stores the complete API response for future reference
- Single table approach simplifies data access and reduces join complexity
- JSONB field allows flexible querying of nested data structures
