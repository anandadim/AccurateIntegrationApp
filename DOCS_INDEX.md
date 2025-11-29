# 📚 Documentation Index

Panduan lengkap untuk navigasi dokumentasi project ini.

## � NEtW: PostgreSQL Migration

**⚠️ PROJECT TELAH DI-MIGRATE KE POSTGRESQL!**

1. **[POSTGRESQL_MIGRATION_SUMMARY.md](POSTGRESQL_MIGRATION_SUMMARY.md)** ⭐⭐⭐
   - Summary lengkap migration
   - What's new, benefits, architecture
   - **BACA INI DULU!**

2. **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** ⭐⭐
   - Step-by-step migration guide
   - Setup instructions
   - Troubleshooting

3. **[INSTALL_POSTGRESQL_WINDOWS.md](INSTALL_POSTGRESQL_WINDOWS.md)** ⭐
   - Install PostgreSQL di Windows
   - 3 options: Installer, Docker, Portable
   - Detailed troubleshooting

4. **[POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)**
   - Database setup & configuration
   - Schema details
   - Performance tips

5. **[SALES_INVOICE_API.md](SALES_INVOICE_API.md)**
   - API documentation lengkap
   - Endpoint usage & examples
   - Query examples

6. **[QUICK_COMMANDS.md](QUICK_COMMANDS.md)**
   - Command reference untuk PostgreSQL
   - Sync, query, backup commands
   - SQL queries

7. **[NEXT_STEPS.md](NEXT_STEPS.md)**
   - Roadmap setelah migration
   - Phase-by-phase implementation
   - Success metrics

## 🚀 Getting Started (Original)

8. **[QUICKSTART.md](QUICKSTART.md)**
   - Cara cepat untuk mulai development
   - Install dan run aplikasi
   - Checklist testing

9. **[README.md](README.md)**
   - Overview project
   - Tech stack
   - Basic structure

## 📖 Main Documentation

### For Developers

10. **[TESTING.md](TESTING.md)**
    - Panduan testing lengkap
    - Step-by-step testing flow
    - Troubleshooting

11. **[ARCHITECTURE.md](ARCHITECTURE.md)**
    - System architecture diagram
    - Request flow
    - Component responsibilities
    - Scalability considerations

12. **[COMMANDS.md](COMMANDS.md)**
    - Command reference lengkap (Legacy)
    - Installation, running, testing
    - Database commands
    - Debugging commands

### For API Integration

13. **[ACCURATE_ENDPOINTS.md](ACCURATE_ENDPOINTS.md)**
    - Daftar endpoint Accurate Online API
    - Cara penggunaan
    - Parameter tambahan

### For Multi-Branch

14. **[MULTI_BRANCH_SETUP.md](MULTI_BRANCH_SETUP.md)**
    - Setup untuk 16 cabang
    - Configuration options
    - Branch management

15. **[SALES_INVOICE_GUIDE.md](SALES_INVOICE_GUIDE.md)**
    - Sales invoice display guide
    - Field mapping
    - Frontend components

### For Database (Legacy - SQLite)

16. **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)**
    - Schema SQLite (legacy)
    - Query examples
    - Maintenance commands

## 📝 Reference Documents

17. **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)**
    - Summary lengkap project (legacy)
    - Features, roadmap, status
    - Known limitations

18. **[CHECKLIST.md](CHECKLIST.md)**
    - Development checklist
    - Phase-by-phase tasks
    - Progress tracking

19. **[NOTES.md](NOTES.md)**
    - Catatan penting
    - Tips debugging
    - Common issues
    - Best practices

## 📂 File Structure Reference

```
Documentation Files:
├── QUICKSTART.md          ← Start here!
├── README.md              ← Project overview
├── TESTING.md             ← Testing guide
├── ARCHITECTURE.md        ← System design
├── COMMANDS.md            ← Command reference
├── ACCURATE_ENDPOINTS.md  ← API endpoints
├── DATABASE_SCHEMA.md     ← Database info
├── PROJECT_SUMMARY.md     ← Complete summary
├── NOTES.md               ← Important notes
└── DOCS_INDEX.md          ← This file

Code Files:
├── backend/               ← Backend source code
├── frontend/              ← Frontend source code
├── package.json           ← Dependencies
├── .env                   ← Credentials (DO NOT COMMIT!)
└── .env.example           ← Template for .env
```

## 🎯 Quick Navigation by Task

### "Saya baru pertama kali buka project ini"
→ Baca: [POSTGRESQL_MIGRATION_SUMMARY.md](POSTGRESQL_MIGRATION_SUMMARY.md) → [NEXT_STEPS.md](NEXT_STEPS.md)

### "Saya mau install PostgreSQL"
→ Baca: [INSTALL_POSTGRESQL_WINDOWS.md](INSTALL_POSTGRESQL_WINDOWS.md)

### "Saya mau setup project dengan PostgreSQL"
→ Baca: [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) → [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)

### "Saya mau sync sales invoices"
→ Baca: [SALES_INVOICE_API.md](SALES_INVOICE_API.md) → [QUICK_COMMANDS.md](QUICK_COMMANDS.md)

### "Saya mau test aplikasi"
→ Baca: [NEXT_STEPS.md](NEXT_STEPS.md) (Phase 1: Testing)

### "Saya mau tahu cara kerja sistem"
→ Baca: [POSTGRESQL_MIGRATION_SUMMARY.md](POSTGRESQL_MIGRATION_SUMMARY.md) (Architecture section)

### "Saya mau tambah endpoint baru"
→ Baca: [ACCURATE_ENDPOINTS.md](ACCURATE_ENDPOINTS.md)

### "Saya mau lihat/query database"
→ Baca: [QUICK_COMMANDS.md](QUICK_COMMANDS.md) (SQL Queries section)

### "Saya dapat error"
→ Baca: [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) (Troubleshooting) → [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md) (Troubleshooting)

### "Saya mau tahu command apa saja yang bisa dipakai"
→ Baca: [QUICK_COMMANDS.md](QUICK_COMMANDS.md)

### "Saya mau tahu roadmap dan next steps"
→ Baca: [NEXT_STEPS.md](NEXT_STEPS.md)

## 📱 Quick Reference

### Essential Commands (PostgreSQL)
```bash
# Install PostgreSQL (Docker)
docker run --name postgres-accurate -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=accurate_db -p 5432:5432 -d postgres:15

# Install dependencies
npm install

# Test database
npm run test:db

# Run backend
npm run dev

# Sync sales invoices
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30"

# Query invoices
curl "http://localhost:3000/api/sales-invoices?branchId=branch-1&limit=10"
```

### Essential URLs
- Backend: http://localhost:3000
- Frontend: http://localhost:5173
- PostgreSQL: localhost:5432
- API Docs: https://accurate.id/api-documentation/

### Essential Files
- Credentials: `.env`
- Database URL: `DATABASE_URL` in `.env`
- Backend entry: `backend/server.js`
- Database config: `backend/config/database.js`
- Sales Invoice Model: `backend/models/salesInvoiceModel.js`
- Branches config: `backend/config/branches.json`

## 🔄 Documentation Update Log

| Date | File | Changes |
|------|------|---------|
| 2024 | All | Initial documentation created |
| Nov 20, 2025 | PostgreSQL docs | Migration to PostgreSQL complete |
| Nov 20, 2025 | DOCS_INDEX.md | Updated with PostgreSQL documentation |

## 💡 Tips

1. **Bookmark file ini** untuk navigasi cepat
2. **Mulai dari QUICKSTART.md** kalau baru pertama kali
3. **COMMANDS.md** berguna untuk copy-paste command
4. **NOTES.md** berisi troubleshooting common issues
5. **Semua file .md bisa dibuka di VS Code** dengan preview (Ctrl+Shift+V)

## 🆘 Need Help?

1. Cek [NOTES.md](NOTES.md) untuk common issues
2. Cek [TESTING.md](TESTING.md) untuk troubleshooting
3. Lihat console/terminal untuk error messages
4. Cek dokumentasi Accurate Online API

---

**Happy Coding! 🚀**

*Last Updated: 2024*
