# Command Reference

## 📦 Installation Commands

### First Time Setup
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

## 🚀 Running the Application

### Development Mode

**Backend (Terminal 1):**
```bash
npm run dev
```
Server akan running di `http://localhost:3000`

**Frontend (Terminal 2):**
```bash
npm run frontend
```
atau
```bash
cd frontend
npm run dev
```
Frontend akan running di `http://localhost:5173`

## 🧪 Testing Commands

### Test Backend API dengan curl

**Health Check:**
```bash
curl http://localhost:3000/
```

**Get Databases:**
```bash
curl http://localhost:3000/api/databases
```

**Get Customer Data:**
```bash
curl "http://localhost:3000/api/data/customer/list?dbId=YOUR_DB_ID"
```

**Get Cached Data:**
```bash
curl "http://localhost:3000/api/cache/customer/list?dbId=YOUR_DB_ID"
```

### Test dengan PowerShell (Windows)

**Health Check:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/" | Select-Object -Expand Content
```

**Get Databases:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/databases"
```

**Get Customer Data:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/data/customer/list?dbId=YOUR_DB_ID"
```

## 🗄️ Database Commands

### SQLite CLI

**Open Database:**
```bash
sqlite3 database/accurate.db
```

**Common Queries:**
```sql
-- List all tables
.tables

-- Show table schema
.schema accurate_data

-- View all cached data
SELECT * FROM accurate_data;

-- View recent cache
SELECT endpoint, cabang_id, updated_at 
FROM accurate_data 
ORDER BY updated_at DESC 
LIMIT 10;

-- Count records
SELECT COUNT(*) FROM accurate_data;

-- Exit
.exit
```

### Database Backup
```bash
# Windows
copy database\accurate.db database\accurate_backup.db

# Linux/Mac
cp database/accurate.db database/accurate_backup.db
```

### Database Reset (Delete all data)
```bash
# Windows
del database\accurate.db

# Linux/Mac
rm database/accurate.db
```
Database akan di-create ulang saat backend start.

## 📝 Git Commands

### Initial Commit
```bash
git init
git add .
git commit -m "Initial commit - Accurate API Integration"
```

### Check Status
```bash
git status
```

### View .gitignore
```bash
# Windows
type .gitignore

# Linux/Mac
cat .gitignore
```

**Important:** File `.env` sudah ada di `.gitignore`, jadi credentials aman.

## 🔍 Debugging Commands

### Check Running Processes

**Windows:**
```powershell
# Check port 3000
netstat -ano | findstr :3000

# Check port 5173
netstat -ano | findstr :5173
```

**Linux/Mac:**
```bash
# Check port 3000
lsof -i :3000

# Check port 5173
lsof -i :5173
```

### Kill Process on Port

**Windows:**
```powershell
# Find PID
netstat -ano | findstr :3000

# Kill process (replace PID)
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Kill process on port 3000
kill -9 $(lsof -t -i:3000)
```

### View Logs

**Backend logs:**
Lihat di terminal tempat backend running

**Frontend logs:**
- Terminal: Lihat di terminal tempat frontend running
- Browser: F12 → Console tab

## 📦 Package Management

### Update Dependencies
```bash
# Check outdated packages
npm outdated

# Update all packages
npm update

# Update specific package
npm update fastify
```

### Add New Package

**Backend:**
```bash
npm install package-name
```

**Frontend:**
```bash
cd frontend
npm install package-name
```

## 🧹 Cleanup Commands

### Remove node_modules
```bash
# Windows
rmdir /s /q node_modules
cd frontend
rmdir /s /q node_modules
cd ..

# Linux/Mac
rm -rf node_modules
rm -rf frontend/node_modules
```

### Clean Install
```bash
# Remove and reinstall
npm ci

cd frontend
npm ci
cd ..
```

## 🔧 Utility Commands

### Check Node Version
```bash
node --version
npm --version
```

### Check Installed Packages
```bash
npm list --depth=0
```

### View Package Info
```bash
npm info fastify
npm info vue
```

## 📊 Performance Commands

### Check Database Size

**Windows:**
```powershell
Get-Item database\accurate.db | Select-Object Length
```

**Linux/Mac:**
```bash
ls -lh database/accurate.db
```

### Monitor Backend Memory

**Windows:**
```powershell
Get-Process node | Select-Object CPU, WorkingSet
```

**Linux/Mac:**
```bash
ps aux | grep node
```

## 🚀 Production Commands (Future)

### Build Frontend
```bash
cd frontend
npm run build
```
Output akan ada di `frontend/dist/`

### Run Production Server
```bash
NODE_ENV=production npm run dev
```

## 📱 Quick Commands Cheat Sheet

```bash
# Start everything
npm run dev                    # Terminal 1: Backend
npm run frontend               # Terminal 2: Frontend

# Test API
curl http://localhost:3000/api/databases

# View database
sqlite3 database/accurate.db

# Backup database
copy database\accurate.db database\backup.db

# Check git status
git status

# View logs
# Just look at the terminal where backend/frontend is running
```

## 🆘 Emergency Commands

### Reset Everything
```bash
# Stop all servers (Ctrl+C in terminals)

# Delete database
del database\accurate.db

# Reinstall dependencies
rmdir /s /q node_modules
npm install

cd frontend
rmdir /s /q node_modules
npm install
cd ..

# Start again
npm run dev
```

### Check if Ports are Free
```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :5173

# If nothing shows up, ports are free
```

---

**Tip:** Simpan file ini untuk reference cepat saat development!
