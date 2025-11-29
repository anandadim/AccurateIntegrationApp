# Architecture Overview

## System Flow

```
┌─────────────┐
│   Browser   │
│  (Vue.js)   │
└──────┬──────┘
       │ HTTP Request
       │ (localhost:5173)
       ↓
┌─────────────────┐
│  Vite Dev Server│
│   (Proxy)       │
└──────┬──────────┘
       │ Proxy to /api
       │ (localhost:3000)
       ↓
┌──────────────────────────────────┐
│     Fastify Backend Server       │
│  ┌────────────────────────────┐  │
│  │  Routes (/api/*)           │  │
│  └────────┬───────────────────┘  │
│           ↓                      │
│  ┌────────────────────────────┐  │
│  │  Controllers               │  │
│  │  - accurateController      │  │
│  └────────┬───────────────────┘  │
│           ↓                      │
│  ┌────────────────────────────┐  │
│  │  Services                  │  │
│  │  - accurateService         │  │
│  └────────┬───────────────────┘  │
│           ↓                      │
│  ┌────────────────────────────┐  │
│  │  Models                    │  │
│  │  - cacheModel              │  │
│  └────────┬───────────────────┘  │
└───────────┼──────────────────────┘
            │
            ├─────────────────┐
            ↓                 ↓
    ┌──────────────┐   ┌─────────────────┐
    │   SQLite     │   │  Accurate API   │
    │   Database   │   │  (External)     │
    └──────────────┘   └─────────────────┘
```

## Request Flow Example

### Scenario: User fetch customer data

```
1. User clicks "Get Customers" button
   ↓
2. Vue component calls apiService.getData('customer/list', dbId)
   ↓
3. Axios sends GET request to /api/data/customer/list?dbId=xxx
   ↓
4. Vite proxy forwards to http://localhost:3000/api/data/customer/list
   ↓
5. Fastify routes to accurateController.getData()
   ↓
6. Controller calls accurateService.fetchData('customer/list', dbId)
   ↓
7. Service makes HTTP request to Accurate Online API
   ↓
8. Accurate API returns customer data
   ↓
9. Service returns data to Controller
   ↓
10. Controller calls cacheModel.saveCache() to store in SQLite
    ↓
11. Controller returns response to Frontend
    ↓
12. Vue component displays data
```

## Data Flow

### GET Data (Current Implementation)

```
Frontend Request
    ↓
Backend receives request
    ↓
Check if data exists in cache? ──→ No ──→ Fetch from Accurate API
    ↓                                           ↓
   Yes                                    Save to SQLite cache
    ↓                                           ↓
Return cached data ←──────────────────────────┘
    ↓
Response to Frontend
```

### Future: Scheduler Implementation

```
Cron Job triggers (e.g., every 6 hours)
    ↓
Fetch data from Accurate API
    ↓
Update SQLite cache
    ↓
Log sync status
    
Meanwhile...

User requests data
    ↓
Return from cache (fast!)
    ↓
Show last_updated timestamp
```

## Component Responsibilities

### Frontend (Vue.js)
**Responsibility:** User Interface & User Experience
- Display data
- Handle user interactions
- Call backend API
- Show loading states
- Handle errors

**Files:**
- `App.vue` - Main component
- `apiService.js` - API calls

### Backend - Routes
**Responsibility:** HTTP routing
- Define API endpoints
- Map URLs to controllers
- Handle HTTP methods

**Files:**
- `routes/api.js`

### Backend - Controllers
**Responsibility:** Request/Response handling
- Validate request parameters
- Call appropriate services
- Format responses
- Handle HTTP status codes

**Files:**
- `controllers/accurateController.js`

### Backend - Services
**Responsibility:** Business logic
- Communicate with external APIs
- Process data
- Apply business rules
- Error handling

**Files:**
- `services/accurateService.js`

### Backend - Models
**Responsibility:** Data persistence
- Database operations (CRUD)
- Query building
- Data transformation

**Files:**
- `models/cacheModel.js`

### Backend - Config
**Responsibility:** Configuration
- Database connection
- Environment variables
- App settings

**Files:**
- `config/database.js`

## Technology Stack Details

### Backend Stack
```
Fastify (Web Framework)
    ├── @fastify/cors (CORS handling)
    ├── dotenv (Environment variables)
    ├── axios (HTTP client for Accurate API)
    └── sqlite3 (Database)
```

### Frontend Stack
```
Vue.js 3 (UI Framework)
    ├── Vite (Build tool & dev server)
    ├── axios (HTTP client)
    └── Native CSS (Styling)
```

## Security Layers

```
1. Environment Variables (.env)
   - Credentials tidak di-hardcode
   - Tidak di-commit ke Git

2. Backend as Proxy
   - Frontend tidak punya akses langsung ke Accurate API
   - Credentials hidden dari browser

3. CORS Configuration
   - Hanya origin tertentu yang bisa akses API

4. (Future) Rate Limiting
   - Prevent abuse
   - Protect Accurate API quota
```

## Scalability Considerations

### Current (Phase 1)
- Single cabang testing
- Direct API calls
- Simple caching

### Future (Phase 2-5)
```
┌─────────────────────────────────┐
│  Load Balancer (Optional)       │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│  Multiple Backend Instances     │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│  PostgreSQL (if needed)         │
│  or SQLite with WAL mode        │
└─────────────────────────────────┘

+ Background Workers for:
  - Scheduled sync (16 cabang)
  - CSV generation
  - Data processing
```

## File Structure Mapping

```
Project Root
│
├── Backend (Node.js/Fastify)
│   ├── server.js ──────────→ Entry point, server setup
│   ├── config/
│   │   └── database.js ────→ SQLite connection
│   ├── routes/
│   │   └── api.js ─────────→ API endpoint definitions
│   ├── controllers/
│   │   └── accurateController.js → Request handlers
│   ├── services/
│   │   └── accurateService.js ──→ Accurate API logic
│   └── models/
│       └── cacheModel.js ──────→ Database operations
│
├── Frontend (Vue.js)
│   ├── index.html ─────────→ HTML entry
│   ├── vite.config.js ─────→ Vite config (proxy)
│   └── src/
│       ├── main.js ────────→ Vue app initialization
│       ├── App.vue ────────→ Main component
│       ├── style.css ──────→ Global styles
│       └── services/
│           └── apiService.js → Backend API calls
│
└── Database
    └── accurate.db ────────→ SQLite database (auto-created)
```

## API Endpoint Mapping

```
Frontend Call                    Backend Route                  Accurate API
─────────────────────────────────────────────────────────────────────────────
apiService.getDatabases()    →   GET /api/databases         →   GET /api/db/list.do

apiService.getData(           →   GET /api/data/:endpoint   →   GET /api/:endpoint.do
  'customer/list',                ?dbId=xxx                      (with X-Session-ID)
  dbId
)

apiService.getCachedData(     →   GET /api/cache/:endpoint  →   (SQLite only,
  'customer/list',                ?dbId=xxx                      no external call)
  dbId
)
```

---

**Note:** Diagram ini menunjukkan architecture untuk Phase 1. Akan berkembang seiring dengan penambahan fitur scheduler, export CSV, dan multi-cabang.
