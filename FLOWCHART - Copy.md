
# Flowchart v2 — Multiple Perspectives

## 1) System Architecture (Runtime Context)
```
┌───────────────────────────────────────────────────────────────┐
│                         CLIENT (Vue)                          │
│  App.vue → Components → apiService (axios)                    │
└───────────────▲───────────────────────┬───────────────────────┘
                │HTTP /api              │CORS
                │                       │
┌───────────────┴───────────────────────▼───────────────────────┐
│                    FASTIFY BACKEND                            │
│  server.js                                                   │
│  • Registers routes (/api)                                   │
│  • Adds JSON parser & CORS                                   │
│  • Initializes PostgreSQL tables                             │
│                                                               │
│  Routes → Controllers → Services                              │
│  accurateController | salesInvoiceController | itemController │
│  customerController | salesReturnController | purchase*Ctrl   │
└───────────────▲───────────────────────┬───────────────────────┘
                │DB Pool (pg)           │External API (HTTPS)
                │                       │
┌───────────────┴─────────────┐   ┌─────┴──────────────────────┐
│       POSTGRESQL DB         │   │     ACCURATE API           │
│  • sales_* / purchase_*     │   │  • list.do / detail.do     │
│  • items / customers / logs │   │  • HMAC signature headers  │
└─────────────────────────────┘   └────────────────────────────┘
```

## 2) Request Lifecycle (Frontend → Backend → DB)
```
User Action (select branch / click sync / fetch)
        │
        ▼
Frontend Component (e.g., PurchaseInvoiceSync / SyncManager)
        │ calls
        ▼
apiService (axios) -> GET/POST /api/...
        │
        ▼
Fastify Route (/api/* in backend/routes/api.js)
        │ delegates
        ▼
Controller (e.g., purchaseInvoiceController)
        │ uses
        ▼
Service Layer
  • accurateService → Accurate API (list/detail, pagination, signature)
  • DB access (pg Pool) → upsert/select
        │
        ▼
PostgreSQL (tables per module)
        │
        ▼
HTTP Response (JSON) → apiService → Component → UI (tables/status)
```

## 3) Sync Pipeline (Smart Sync Focus)
```
Start Sync (module + branch + date range)
        │
        ▼
Check Sync Status
  • Compare API list vs DB (ids/optLock/timestamps)
        │
        ▼
Smart Sync Decision
  • Mode: missing | all
  • Select only new/updated IDs
        │
        ▼
Fetch List (paginated, pageSize=1000)
        │
        ▼
Batch Detail Fetch (configurable batchSize/batchDelay)
        │
        ▼
Transform & Validate
  • Map Accurate fields → DB schema
  • Handle dates, amounts, relations
        │
        ▼
Stream Insert/Upsert to DB
  • Header & detail tables
  • Relations (e.g., sales_invoice_relations)
        │
        ▼
Log & Metrics
  • api_logs + console progress
        │
        ▼
Return Summary to UI
  • savedCount, errorCount, totalFetched
```

## 4) Data & Storage Perspective (Tables by Domain)
```
Sales Invoices:
  - sales_invoices (header)
  - sales_invoice_items (lines)
  - sales_invoice_relations (SI ↔ SO ↔ SR mapping)

Sales Orders / Returns / Receipts:
  - sales_orders, sales_order_items
  - sales_returns, sales_return_items
  - sales_receipts, sales_receipt_items

Purchase:
  - purchase_invoices, purchase_invoice_items
  - purchase_orders, purchase_order_items

Masters:
  - items, warehouse_stock, warehouses
  - customers

Support:
  - api_logs (endpoint/status/time/error)
```

## 5) Error & Resilience Flow
```
Accurate API Call
  │
  ├─ Success → proceed
  └─ Error  → capture message (from API d[]), return structured error
                │
                ▼
Controller
  • Wraps service errors → HTTP 4xx/5xx
  • Adds context (endpoint, branch)
                │
                ▼
Frontend
  • Shows error banners/messages
  • Clears loading states
  • Allows retry/reload branches
```

## 6) Multi-Branch Perspective
```
branches.json → { id, name, dbId, credentials, baseUrl, active }
        │
        ▼
accurateService:
  • loadBranchesConfig() with cache
  • getBranchConfig(branchId) → credentials + baseUrl
  • createApiClient(dbId, branchId) adds:
      - Authorization: Bearer clientId
      - X-API-Timestamp + HMAC signature
      - X-Session-ID: dbId (per branch DB)
        │
        ▼
Per-branch operations:
  • UI selects branch → passes branchId, dbId
  • API calls use branch-specific session & baseUrl
  • DB upserts keyed by (branch_id, entity_id)
```
