# Accurate Online API Integration

Web app untuk mengintegrasikan data dari Accurate Online API dengan fokus pada GET data, caching, dan display.

## ⚠️ IMPORTANT: PostgreSQL Migration Complete!

Project telah di-migrate dari SQLite ke PostgreSQL untuk support 16 cabang dengan concurrent operations.

**👉 [START HERE - Quick Start Guide](START_HERE.md)**

## 🚀 Quick Start

```bash
# 1. Setup PostgreSQL (see POSTGRESQL_SETUP.md)
# Install PostgreSQL or use Docker

# 2. Install dependencies
npm install
cd frontend && npm install && cd ..

# 3. Configure .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db

# 4. Run backend (Terminal 1)
npm run dev

# 5. Run frontend (Terminal 2)
npm run frontend

# 6. Open browser
http://localhost:5173
```

**📖 Dokumentasi lengkap:** Lihat [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) atau [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)

## Tech Stack
- **Backend**: Fastify + PostgreSQL
- **Frontend**: Vue.js 3 + Vite
- **API**: Accurate Online REST API
- **Database**: PostgreSQL 15+ (migrated from SQLite)

## Features (Phase 1)

✅ **Implemented:**
- Koneksi ke Accurate Online API dengan OAuth
- GET data dari multiple endpoints (customer, item, sales-invoice, dll)
- Auto-cache data di SQLite
- Frontend Vue.js untuk testing dan display
- MVC architecture untuk maintainability

## Project Structure
```
├── backend/
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic & API calls
│   ├── models/         # Database operations
│   ├── routes/         # Route definitions
│   ├── config/         # Database config
│   └── server.js       # Entry point
├── frontend/
│   ├── src/
│   │   ├── services/   # API calls
│   │   ├── App.vue     # Main component
│   │   └── main.js     # Entry point
│   └── vite.config.js  # Vite config
└── database/           # SQLite database (auto-created)
```

## 📚 Documentation

| File | Description |
|------|-------------|
| [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) | 🔄 Migration SQLite → PostgreSQL |
| [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) | 🐘 PostgreSQL setup guide |
| [SALES_INVOICE_API.md](SALES_INVOICE_API.md) | 📄 Sales Invoice API docs |
| [DOCS_INDEX.md](DOCS_INDEX.md) | 📑 Index semua dokumentasi |
| [QUICKSTART.md](QUICKSTART.md) | ⚡ Panduan cepat mulai |
| [TESTING.md](TESTING.md) | 🧪 Panduan testing lengkap |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 🏗️ System architecture |
| [ACCURATE_ENDPOINTS.md](ACCURATE_ENDPOINTS.md) | 🔌 Daftar API endpoints |

## API Endpoints

### Sales Invoice (PostgreSQL)
- `POST /api/sales-invoices/sync` - Sync from Accurate API
- `GET /api/sales-invoices` - Query invoices
- `GET /api/sales-invoices/:id` - Get detail with items
- `GET /api/sales-invoices/summary/stats` - Statistics

### Legacy Endpoints (Backward Compatible)
- `GET /api/databases` - List database (cabang)
- `GET /api/data/:endpoint?dbId=xxx` - Fetch dari Accurate API
- `GET /api/cache/:endpoint?dbId=xxx` - Get dari cache

See [SALES_INVOICE_API.md](SALES_INVOICE_API.md) for complete API documentation.

## Roadmap

**Phase 1: GET Data** ✅ (Current)
- ✓ Backend setup
- ✓ Frontend setup
- ✓ API integration
- ✓ SQLite caching

**Phase 2: Scheduler** (Next)
- [ ] Setup node-cron
- [ ] Auto-sync data
- [ ] Background jobs

**Phase 3: Export CSV**
- [ ] CSV export endpoint
- [ ] Download functionality

**Phase 4: CRUD Operations**
- [ ] POST endpoints
- [ ] UPDATE endpoints
- [ ] DELETE endpoints

**Phase 5: Multi-Cabang**
- [ ] Scale ke 16 cabang
- [ ] Bulk operations

## 🔐 Security

- Credentials disimpan di `.env` (tidak di-commit)
- Backend sebagai proxy untuk hide credentials
- CORS enabled untuk development

## 🆘 Troubleshooting

Lihat [NOTES.md](NOTES.md) untuk common issues dan solutions.

## 📞 Support

- Dokumentasi Accurate API: https://accurate.id/api-documentation/
- Fastify Docs: https://fastify.dev/
- Vue.js Docs: https://vuejs.org/

---

**Status:** Ready for Testing (Phase 1)  
**Version:** 1.0.0
