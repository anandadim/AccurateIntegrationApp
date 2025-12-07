# Goods API Documentation

## Overview
Goods (Barang) API provides endpoints to sync and manage product/inventory data from Accurate ERP system to PostgreSQL database. The implementation follows the same pattern as Purchase Invoice with header and detail tables.

## Database Schema

### Tables

#### 1. **goods** (Header Table)
Main goods/product information table.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Database ID |
| goods_id | BIGINT UNIQUE | Accurate system ID |
| goods_no | VARCHAR(50) | Product code (e.g., SAPI-SNJ-563) |
| goods_name | VARCHAR(255) | Product name |
| short_name | VARCHAR(255) | Short product name |
| category_id | VARCHAR(50) | Category ID from Accurate |
| category_name | VARCHAR(255) | Category name (e.g., DAGING SAPI) |
| unit1_id | VARCHAR(50) | Primary unit ID |
| unit1_name | VARCHAR(50) | Primary unit name (e.g., KG) |
| unit1_price | DECIMAL(15,2) | Price per unit1 |
| cost | DECIMAL(15,2) | Cost price |
| unit_price | DECIMAL(15,2) | Selling unit price |
| item_type | VARCHAR(50) | Type (e.g., INVENTORY, SERVICE) |
| suspended | BOOLEAN | Active/inactive status |
| opt_lock | INTEGER | Optimistic locking version |
| raw_data | JSONB | Full raw data from API |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

**Indexes:**
- `idx_goods_no` on goods_no
- `idx_goods_category` on category_id
- `idx_goods_type` on item_type
- `idx_goods_suspended` on suspended

#### 2. **goods_warehouse_details** (Detail Table)
Warehouse-specific stock and location information.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Database ID |
| goods_id | BIGINT FK | Reference to goods table |
| warehouse_id | VARCHAR(50) | Warehouse ID |
| warehouse_name | VARCHAR(255) | Warehouse name (e.g., CIKARANG UTARA) |
| location_id | VARCHAR(50) | Location ID |
| unit1_quantity | DECIMAL(15,2) | Quantity in unit1 |
| balance | DECIMAL(15,2) | Current balance |
| balance_unit | VARCHAR(50) | Balance unit (e.g., "0 KG") |
| default_warehouse | BOOLEAN | Is default warehouse |
| scrap_warehouse | BOOLEAN | Is scrap warehouse |
| suspended | BOOLEAN | Warehouse status |
| description | TEXT | Warehouse description |
| pic | VARCHAR(255) | Person in charge |
| opt_lock | INTEGER | Optimistic locking version |
| created_at | TIMESTAMP | Record creation time |

**Indexes:**
- `idx_goods_warehouse_details_goods` on goods_id
- `idx_goods_warehouse_details_warehouse` on warehouse_id

#### 3. **goods_selling_prices** (Detail Table)
Selling price information per category and branch.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | Database ID |
| goods_id | BIGINT FK | Reference to goods table |
| unit_id | VARCHAR(50) | Unit ID |
| unit_name | VARCHAR(50) | Unit name |
| price | DECIMAL(15,2) | Selling price |
| price_category_id | VARCHAR(50) | Price category ID |
| price_category_name | VARCHAR(255) | Price category name (e.g., Umum) |
| currency_code | VARCHAR(10) | Currency code (e.g., IDR) |
| currency_symbol | VARCHAR(10) | Currency symbol (e.g., Rp) |
| branch_id | VARCHAR(50) | Branch ID |
| branch_name | VARCHAR(255) | Branch name |
| effective_date | DATE | Effective date |
| opt_lock | INTEGER | Optimistic locking version |
| created_at | TIMESTAMP | Record creation time |

**Indexes:**
- `idx_goods_selling_prices_goods` on goods_id
- `idx_goods_selling_prices_category` on price_category_id

## API Endpoints

### 1. Check Sync Status
**GET** `/api/goods/check-sync`

Compare goods in Accurate API with database to determine what needs syncing.

**Query Parameters:**
- `branchId` (required): Branch ID from config

**Response:**
```json
{
  "success": true,
  "branch": {
    "id": "50",
    "name": "Kantor Pusat",
    "dbId": "1"
  },
  "summary": {
    "total": 1500,
    "new": 45,
    "updated": 12,
    "unchanged": 1443,
    "needSync": 57,
    "inDatabase": 1455
  },
  "goods": {
    "new": [
      {
        "id": 2101,
        "no": "SAPI-SNJ-563",
        "name": "*S* RIB END MEAT SWIFT",
        "optLock": 3
      }
    ],
    "updated": [],
    "hasMore": {
      "new": false,
      "updated": false
    }
  },
  "recommendation": "sync_needed"
}
```

### 2. Count Goods
**GET** `/api/goods/count`

Get total count of goods in database without fetching all data.

**Response:**
```json
{
  "success": true,
  "count": 1455
}
```

### 3. Sync Goods
**POST** `/api/goods/sync`

Sync all goods from Accurate API to PostgreSQL database.

**Request Body:**
```json
{
  "branchId": "50",
  "batchSize": 50,
  "delayMs": 100,
  "streamInsert": false
}
```

**Parameters:**
- `branchId` (required): Branch ID
- `batchSize` (optional, default 50): Items per batch
- `delayMs` (optional, default 100): Delay between batches in milliseconds
- `streamInsert` (optional, default false): Stream insert mode

**Response:**
```json
{
  "success": true,
  "branch": {
    "id": "50",
    "name": "Kantor Pusat"
  },
  "results": {
    "total": 1500,
    "saved": 1500,
    "errors": 0,
    "processed": 1500,
    "duration": "45.32s"
  }
}
```

### 4. Get All Goods
**GET** `/api/goods`

Retrieve goods from database with optional filters.

**Query Parameters:**
- `category_id` (optional): Filter by category ID
- `item_type` (optional): Filter by item type
- `suspended` (optional): Filter by status (true/false)
- `search` (optional): Search in goods_no or goods_name
- `limit` (optional, default 50): Results per page
- `offset` (optional, default 0): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "goods_id": 2101,
      "goods_no": "SAPI-SNJ-563",
      "goods_name": "*S* RIB END MEAT SWIFT",
      "short_name": "*S* RIB END MEAT SWIFT",
      "category_id": "52",
      "category_name": "DAGING SAPI",
      "unit1_id": "100",
      "unit1_name": "KG",
      "unit1_price": 70000,
      "cost": 0,
      "unit_price": 70000,
      "item_type": "INVENTORY",
      "suspended": true,
      "opt_lock": 3,
      "created_at": "2024-12-04T10:30:00Z",
      "updated_at": "2024-12-04T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

### 5. Get Goods by ID
**GET** `/api/goods/:id`

Get detailed information for a specific goods including warehouse details and selling prices.

**Path Parameters:**
- `id` (required): Database ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "goods_id": 2101,
    "goods_no": "SAPI-SNJ-563",
    "goods_name": "*S* RIB END MEAT SWIFT",
    "short_name": "*S* RIB END MEAT SWIFT",
    "category_id": "52",
    "category_name": "DAGING SAPI",
    "unit1_id": "100",
    "unit1_name": "KG",
    "unit1_price": 70000,
    "cost": 0,
    "unit_price": 70000,
    "item_type": "INVENTORY",
    "suspended": true,
    "opt_lock": 3,
    "created_at": "2024-12-04T10:30:00Z",
    "updated_at": "2024-12-04T10:30:00Z",
    "warehouseDetails": [
      {
        "id": 1,
        "goods_id": 2101,
        "warehouse_id": "50",
        "warehouse_name": "CIKARANG UTARA",
        "location_id": "52",
        "unit1_quantity": 0,
        "balance": 0,
        "balance_unit": "0 KG",
        "default_warehouse": true,
        "scrap_warehouse": false,
        "suspended": false,
        "description": null,
        "pic": null,
        "opt_lock": 3,
        "created_at": "2024-12-04T10:30:00Z"
      }
    ],
    "sellingPrices": [
      {
        "id": 1,
        "goods_id": 2101,
        "unit_id": "100",
        "unit_name": "KG",
        "price": 70000,
        "price_category_id": "50",
        "price_category_name": "Umum",
        "currency_code": "IDR",
        "currency_symbol": "Rp",
        "branch_id": "50",
        "branch_name": "Kantor Pusat",
        "effective_date": "2023-06-10",
        "opt_lock": 0,
        "created_at": "2024-12-04T10:30:00Z"
      }
    ]
  }
}
```

### 6. Get Summary Statistics
**GET** `/api/goods/summary/stats`

Get summary statistics grouped by type and warehouse.

**Query Parameters:**
- `category_id` (optional): Filter by category
- `suspended` (optional): Filter by status

**Response:**
```json
{
  "success": true,
  "data": {
    "byType": [
      {
        "item_type": "INVENTORY",
        "goods_count": 1455,
        "active_count": 1200,
        "suspended_count": 255,
        "avg_price": 45000.50,
        "min_price": 1000,
        "max_price": 500000
      }
    ],
    "byWarehouse": [
      {
        "warehouse_id": "50",
        "warehouse_name": "CIKARANG UTARA",
        "goods_count": 1455,
        "total_quantity": 5000.50,
        "total_balance": 4800.25
      },
      {
        "warehouse_id": "100",
        "warehouse_name": "KEDAI",
        "goods_count": 1200,
        "total_quantity": 2000.00,
        "total_balance": 1950.75
      }
    ]
  }
}
```

## Data Mapping

### From Accurate API to Database

| Accurate Field | Database Field | Table |
|---|---|---|
| id | goods_id | goods |
| no | goods_no | goods |
| name | goods_name | goods |
| shortName | short_name | goods |
| itemCategory.id | category_id | goods |
| itemCategory.name | category_name | goods |
| unit1.id | unit1_id | goods |
| unit1.name | unit1_name | goods |
| unit1Price | unit1_price | goods |
| cost | cost | goods |
| unitPrice | unit_price | goods |
| itemType | item_type | goods |
| suspended | suspended | goods |
| optLock | opt_lock | goods |
| detailWarehouseData[] | goods_warehouse_details | goods_warehouse_details |
| detailSellingPrice[] | goods_selling_prices | goods_selling_prices |

### Warehouse Details Mapping
| Accurate Field | Database Field |
|---|---|
| id | warehouse_id |
| warehouseName/name | warehouse_name |
| locationId | location_id |
| unit1Quantity | unit1_quantity |
| balance | balance |
| balanceUnit | balance_unit |
| defaultWarehouse | default_warehouse |
| scrapWarehouse | scrap_warehouse |
| suspended | suspended |
| description | description |
| pic | pic |
| optLock | opt_lock |

### Selling Price Mapping
| Accurate Field | Database Field |
|---|---|
| unit.id | unit_id |
| unit.name | unit_name |
| price | price |
| priceCategory.id | price_category_id |
| priceCategory.name | price_category_name |
| currency.code | currency_code |
| currency.symbol | currency_symbol |
| branch.id | branch_id |
| branch.name | branch_name |
| effectiveDate | effective_date |
| optLock | opt_lock |

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
  "message": "Detailed error message"
}
```

## Usage Examples

### Check Sync Status
```bash
curl -X GET "http://localhost:3000/api/goods/check-sync?branchId=50"
```

### Sync All Goods
```bash
curl -X POST "http://localhost:3000/api/goods/sync" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "50",
    "batchSize": 50,
    "delayMs": 100
  }'
```

### Get Goods with Filters
```bash
curl -X GET "http://localhost:3000/api/goods?category_id=52&suspended=false&limit=20&offset=0"
```

### Get Specific Goods Details
```bash
curl -X GET "http://localhost:3000/api/goods/1"
```

### Get Summary Statistics
```bash
curl -X GET "http://localhost:3000/api/goods/summary/stats?category_id=52"
```

## Features

- ✅ Header and detail table structure (goods + warehouse + prices)
- ✅ Optimistic locking for sync detection
- ✅ Batch processing with configurable size and delay
- ✅ Transaction support for data integrity
- ✅ Full error handling and logging
- ✅ Pagination support
- ✅ Multiple filter options
- ✅ Warehouse stock tracking
- ✅ Selling price management
- ✅ Summary statistics
- ✅ Automatic updated_at timestamp

## Performance Considerations

1. **Batch Processing**: Default batch size is 50 items. Adjust based on system capacity.
2. **Delay Between Batches**: Default 100ms to avoid overwhelming the API.
3. **Indexes**: All key columns are indexed for fast queries.
4. **Pagination**: Use limit/offset for large result sets.
5. **Filtering**: Use specific filters to reduce data transfer.

## Notes

- Goods are identified by `goods_id` (Accurate system ID) for sync detection
- Optimistic locking (`opt_lock`) is used to detect changes in Accurate
- Warehouse details and selling prices are stored separately for flexibility
- All timestamps are in UTC
- Raw API data is stored in JSONB for audit trail
