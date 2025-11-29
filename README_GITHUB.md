# Accurate Online API Integration

Web application untuk integrasi dengan Accurate Online API menggunakan PostgreSQL untuk multi-branch operations.

## 🚀 Features

- ✅ Multi-branch support (up to 16 branches)
- ✅ PostgreSQL database for concurrent operations
- ✅ Sales Invoice sync with detailed items
- ✅ RESTful API with Fastify
- ✅ Vue.js 3 frontend
- ✅ Automatic data caching
- ✅ Date range filtering
- ✅ Summary statistics

## 📋 Prerequisites

- Node.js 16+ 
- PostgreSQL 15+
- Accurate Online API credentials

## 🔧 Installation

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 2. Install Dependencies

```bash
# Backend
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 3. Setup PostgreSQL

**Option A: Using Docker**
```bash
docker run --name postgres-accurate \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=accurate_db \
  -p 5432:5432 \
  -d postgres:15
```

**Option B: Install PostgreSQL**
- Download from https://www.postgresql.org/download/
- Create database: `CREATE DATABASE accurate_db;`

See [INSTALL_POSTGRESQL_WINDOWS.md](INSTALL_POSTGRESQL_WINDOWS.md) for detailed instructions.

### 4. Configure Environment

```bash
# Copy example files
cp .env.example .env
cp backend/config/branches.example.json backend/config/branches.json

# Edit .env with your credentials
# Edit branches.json with your branch credentials
```

### 5. Run Application

```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
npm run frontend
```

Access: http://localhost:5173

## 📚 Documentation

- [START_HERE.md](START_HERE.md) - Quick start guide
- [POSTGRESQL_MIGRATION_SUMMARY.md](POSTGRESQL_MIGRATION_SUMMARY.md) - Migration overview
- [SALES_INVOICE_API.md](SALES_INVOICE_API.md) - API documentation
- [QUICK_COMMANDS.md](QUICK_COMMANDS.md) - Command reference
- [NEXT_STEPS.md](NEXT_STEPS.md) - Development roadmap

## 🔌 API Endpoints

### Sales Invoice (PostgreSQL)
```bash
# Sync from Accurate API
POST /api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-01&dateTo=2025-11-30

# Query invoices
GET /api/sales-invoices?branchId=branch-1&limit=100

# Get detail with items
GET /api/sales-invoices/:id

# Get statistics
GET /api/sales-invoices/summary/stats?branchId=branch-1
```

### Legacy Endpoints
```bash
GET /api/databases
GET /api/branches
GET /api/data/:endpoint?dbId=xxx
GET /api/details/:endpoint?dbId=xxx
```

## 🗄️ Database Schema

### sales_invoices
- Header information (invoice number, date, customer, total, etc.)
- Supports multiple branches
- JSONB for raw API data

### sales_invoice_items
- Line items per invoice
- Item details (code, name, quantity, price, amount)
- Foreign key to sales_invoices

See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) for complete schema.

## 🔐 Security

- ⚠️ **NEVER commit `.env` or `branches.json`** - Contains sensitive credentials
- Use `.env.example` and `branches.example.json` as templates
- Credentials are stored securely and not exposed to frontend
- Backend acts as proxy to Accurate API

## 🧪 Testing

```bash
# Test database connection
npm run test:db

# Test complete workflow
npm run test:workflow
```

## 📊 Tech Stack

- **Backend:** Fastify, Node.js
- **Database:** PostgreSQL 15+
- **Frontend:** Vue.js 3, Vite
- **API:** Accurate Online REST API

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is private and proprietary.

## 🆘 Support

For issues and questions:
1. Check [DOCS_INDEX.md](DOCS_INDEX.md) for documentation
2. See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) for troubleshooting
3. Review [FIX_POSTGRESQL_PASSWORD.md](FIX_POSTGRESQL_PASSWORD.md) for common issues

## 🎯 Roadmap

- [x] Phase 1: GET Data with PostgreSQL
- [x] Multi-branch support (3 branches configured)
- [ ] Add remaining 13 branches
- [ ] Scheduler for auto-sync
- [ ] CSV export functionality
- [ ] Dashboard with analytics
- [ ] CRUD operations

---

**Status:** Production Ready for Multi-Branch Operations  
**Version:** 2.0.0 (PostgreSQL)  
**Last Updated:** November 2025
