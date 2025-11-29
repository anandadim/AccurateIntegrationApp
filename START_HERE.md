# 🚀 START HERE - PostgreSQL Migration Complete!

## ⚠️ IMPORTANT: Project Telah Di-Migrate ke PostgreSQL

Project ini **SUDAH TIDAK MENGGUNAKAN SQLite** lagi. Sekarang menggunakan **PostgreSQL** untuk support 16 cabang dengan concurrent operations.

## 📋 Quick Start (5 Steps)

### Step 1: Install PostgreSQL

**Pilih salah satu:**

**Option A: Docker (Recommended - Paling Mudah)**
```bash
docker run --name postgres-accurate -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=accurate_db -p 5432:5432 -d postgres:15
```

**Option B: Installer**
- Download: https://www.postgresql.org/download/windows/
- Install dengan password: `postgres`
- Database name: `accurate_db`

📖 Detail: [INSTALL_POSTGRESQL_WINDOWS.md](INSTALL_POSTGRESQL_WINDOWS.md)

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure .env

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db
```

### Step 4: Start Backend

```bash
npm run dev
```

Tables akan otomatis dibuat. Check log:
```
✅ Connected to PostgreSQL database
✅ Database tables initialized successfully
```

### Step 5: Test & Sync

```bash
# Test connection
npm run test:db

# Sync sales invoices
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30&maxItems=50"

# Query data
curl "http://localhost:3000/api/sales-invoices?branchId=branch-1&limit=10"
```

## ✅ Done! What's Next?

### Immediate Tasks
1. ✅ PostgreSQL running
2. ✅ Backend running
3. ✅ Data synced
4. → Add remaining 13 branches to `backend/config/branches.json`
5. → Sync all branches
6. → Setup scheduler for auto-sync

### Read These Docs

**Must Read:**
- [POSTGRESQL_MIGRATION_SUMMARY.md](POSTGRESQL_MIGRATION_SUMMARY.md) - What changed & why
- [NEXT_STEPS.md](NEXT_STEPS.md) - Roadmap & implementation plan

**Reference:**
- [SALES_INVOICE_API.md](SALES_INVOICE_API.md) - API documentation
- [QUICK_COMMANDS.md](QUICK_COMMANDS.md) - Command reference
- [DOCS_INDEX.md](DOCS_INDEX.md) - All documentation

## 🎯 Key Features

### New API Endpoints

```bash
# Sync from Accurate API
POST /api/sales-invoices/sync
  ?branchId=branch-1
  &dateFrom=2025-11-01
  &dateTo=2025-11-30
  &maxItems=100

# Query invoices
GET /api/sales-invoices
  ?branchId=branch-1
  &dateFrom=2025-11-01
  &limit=100

# Get detail
GET /api/sales-invoices/:id

# Get summary
GET /api/sales-invoices/summary/stats
  ?branchId=branch-1
```

### Database Tables

```
sales_invoices          → Header (invoice info)
sales_invoice_items     → Detail (items per invoice)
api_logs               → Monitoring
accurate_data          → Legacy cache
```

## 💡 Benefits of PostgreSQL

✅ **Concurrent Operations** - 16 cabang bisa sync bersamaan  
✅ **Performance** - Optimized indexes, fast queries  
✅ **Scalability** - Handle millions of records  
✅ **Features** - JSONB, advanced queries, full-text search  
✅ **Production Ready** - ACID compliant, reliable  

## 🆘 Troubleshooting

### Error: "password authentication failed"

PostgreSQL sudah terinstall tapi password tidak diketahui?

**Quick Fix:** Gunakan Docker di port berbeda
```bash
# Start Docker Desktop dulu
docker run --name postgres-accurate -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=accurate_db -p 5433:5432 -d postgres:15

# Update .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/accurate_db
```

📖 Detail: [FIX_POSTGRESQL_PASSWORD.md](FIX_POSTGRESQL_PASSWORD.md)

### PostgreSQL not running?
```bash
# Docker
docker ps
docker start postgres-accurate

# Windows Service
services.msc → postgresql-x64-17 → Start
```

### Connection error?
```bash
# Test connection
psql -U postgres -d accurate_db

# Check .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db
```

### Can't sync data?
```bash
# Check backend is running
curl http://localhost:3000/

# Check branches config
cat backend/config/branches.json

# Check Accurate API credentials
# Make sure tokens are valid
```

## 📚 Documentation Structure

```
START_HERE.md                          ← You are here!
├── POSTGRESQL_MIGRATION_SUMMARY.md    ← What changed
├── NEXT_STEPS.md                      ← What to do next
├── INSTALL_POSTGRESQL_WINDOWS.md      ← Install guide
├── MIGRATION_GUIDE.md                 ← Migration steps
├── POSTGRESQL_SETUP.md                ← Database setup
├── SALES_INVOICE_API.md               ← API docs
├── QUICK_COMMANDS.md                  ← Command reference
└── DOCS_INDEX.md                      ← All docs index
```

## 🎉 Success Criteria

You're ready when:
- ✅ PostgreSQL is running
- ✅ Backend starts without errors
- ✅ `npm run test:db` shows tables created
- ✅ Can sync data from Accurate API
- ✅ Can query data from PostgreSQL

## 🚀 Production Roadmap

**Week 1:** Setup & Testing (3 branches)  
**Week 2:** Add all 16 branches + Scheduler  
**Week 3:** Export CSV + Dashboard  
**Week 4:** Production deployment  

See [NEXT_STEPS.md](NEXT_STEPS.md) for detailed roadmap.

---

**Status:** ✅ Migration Complete  
**Database:** PostgreSQL 15+  
**Ready for:** 16 Branches Production  
**Date:** November 20, 2025

**Need Help?** Check [DOCS_INDEX.md](DOCS_INDEX.md) for complete documentation.
