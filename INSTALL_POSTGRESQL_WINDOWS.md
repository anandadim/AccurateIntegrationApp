# Install PostgreSQL di Windows

## Option 1: PostgreSQL Installer (Recommended untuk Production)

### Step 1: Download

1. Buka https://www.postgresql.org/download/windows/
2. Klik "Download the installer"
3. Pilih versi PostgreSQL 15 atau 16 (64-bit)
4. Download file installer (~250MB)

### Step 2: Install

1. Run installer sebagai Administrator
2. Klik "Next" di welcome screen
3. **Installation Directory:** Biarkan default (`C:\Program Files\PostgreSQL\15`)
4. **Select Components:** Centang semua (PostgreSQL Server, pgAdmin 4, Command Line Tools)
5. **Data Directory:** Biarkan default (`C:\Program Files\PostgreSQL\15\data`)
6. **Password:** Set password untuk superuser `postgres` (contoh: `postgres`)
   - ⚠️ **INGAT PASSWORD INI!** Akan digunakan di .env
7. **Port:** Biarkan default `5432`
8. **Locale:** Pilih "English, United States" atau "Indonesian, Indonesia"
9. Klik "Next" dan tunggu instalasi selesai (~5 menit)

### Step 3: Verify Installation

```bash
# Buka Command Prompt atau PowerShell
psql --version
# Output: psql (PostgreSQL) 15.x
```

### Step 4: Create Database

```bash
# Connect sebagai postgres user
psql -U postgres

# Masukkan password yang tadi dibuat
# Password: postgres

# Create database
CREATE DATABASE accurate_db;

# Verify
\l

# Exit
\q
```

### Step 5: Update .env

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db
```

Format: `postgresql://[user]:[password]@[host]:[port]/[database]`

---

## Option 2: Docker (Recommended untuk Development)

### Prerequisites

Install Docker Desktop for Windows:
- Download: https://www.docker.com/products/docker-desktop/
- Install dan restart komputer

### Step 1: Run PostgreSQL Container

```bash
# Buka PowerShell atau Command Prompt
docker run --name postgres-accurate ^
  -e POSTGRES_PASSWORD=postgres ^
  -e POSTGRES_DB=accurate_db ^
  -p 5432:5432 ^
  -d postgres:15
```

### Step 2: Verify Container

```bash
# Check container is running
docker ps

# Should show:
# CONTAINER ID   IMAGE         PORTS                    NAMES
# xxxxxxxxxxxx   postgres:15   0.0.0.0:5432->5432/tcp   postgres-accurate
```

### Step 3: Connect to Database

```bash
# Connect using docker exec
docker exec -it postgres-accurate psql -U postgres -d accurate_db

# Or install psql client and connect normally
psql -U postgres -h localhost -d accurate_db
```

### Step 4: Update .env

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db
```

### Docker Commands

```bash
# Start container
docker start postgres-accurate

# Stop container
docker stop postgres-accurate

# Restart container
docker restart postgres-accurate

# View logs
docker logs postgres-accurate

# Remove container (data will be lost!)
docker rm -f postgres-accurate
```

---

## Option 3: Portable PostgreSQL (No Installation)

### Step 1: Download

1. Download PostgreSQL Portable: https://sourceforge.net/projects/pgsqlportable/
2. Extract ke folder (contoh: `C:\PostgreSQL-Portable`)

### Step 2: Initialize

```bash
cd C:\PostgreSQL-Portable\bin
initdb -D ..\data -U postgres -W
# Set password: postgres
```

### Step 3: Start Server

```bash
pg_ctl -D ..\data start
```

### Step 4: Create Database

```bash
createdb -U postgres accurate_db
```

---

## Verification

Setelah install dengan salah satu option di atas:

### 1. Test Connection

```bash
psql -U postgres -d accurate_db
```

Jika berhasil, akan muncul prompt:
```
accurate_db=#
```

### 2. Test dari Node.js

```bash
# Di project folder
npm install
npm run test:db
```

Expected output:
```
✅ Connected to PostgreSQL
PostgreSQL Version: PostgreSQL 15.x
📋 Tables:
  - sales_invoices
  - sales_invoice_items
  - api_logs
  - accurate_data
```

---

## Troubleshooting

### Error: "psql: command not found"

**Solution:** Add PostgreSQL to PATH

1. Buka System Properties → Environment Variables
2. Edit PATH variable
3. Add: `C:\Program Files\PostgreSQL\15\bin`
4. Restart Command Prompt

### Error: "could not connect to server"

**Solution 1:** Check service is running
```bash
# Windows: Open services.msc
# Look for "postgresql-x64-15"
# Status should be "Running"
```

**Solution 2:** Start service manually
```bash
# PowerShell (as Administrator)
Start-Service postgresql-x64-15
```

**Solution 3:** Check port
```bash
netstat -ano | findstr :5432
# Should show LISTENING
```

### Error: "password authentication failed"

**Solution:** Reset password
```bash
# Edit pg_hba.conf
# Location: C:\Program Files\PostgreSQL\15\data\pg_hba.conf

# Change this line:
# host    all             all             127.0.0.1/32            scram-sha-256

# To:
# host    all             all             127.0.0.1/32            trust

# Restart PostgreSQL service
# Then connect and reset password:
psql -U postgres
ALTER USER postgres PASSWORD 'postgres';

# Change pg_hba.conf back to scram-sha-256
# Restart service again
```

### Error: "port 5432 already in use"

**Solution:** Kill process or change port

```bash
# Find process using port 5432
netstat -ano | findstr :5432

# Kill process (replace PID)
taskkill /PID <PID> /F

# Or change port in postgresql.conf
# Location: C:\Program Files\PostgreSQL\15\data\postgresql.conf
# Change: port = 5433
# Update .env: DATABASE_URL=postgresql://postgres:postgres@localhost:5433/accurate_db
```

---

## GUI Tools (Optional)

### pgAdmin 4 (Included with PostgreSQL)

- Sudah terinstall otomatis
- Buka dari Start Menu: "pgAdmin 4"
- Add server:
  - Host: localhost
  - Port: 5432
  - Username: postgres
  - Password: postgres
  - Database: accurate_db

### DBeaver (Alternative)

- Download: https://dbeaver.io/download/
- Free, cross-platform
- Support multiple databases

### Azure Data Studio (Microsoft)

- Download: https://docs.microsoft.com/en-us/sql/azure-data-studio/download
- Modern UI
- Good for SQL Server users

---

## Performance Tips

### 1. Increase Memory (Optional)

Edit `postgresql.conf`:
```
shared_buffers = 256MB          # Default: 128MB
effective_cache_size = 1GB      # Default: 4GB
work_mem = 16MB                 # Default: 4MB
```

### 2. Enable Logging (Optional)

```
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d.log'
log_statement = 'all'           # Log all queries (for debugging)
```

### 3. Backup Configuration

```bash
# Backup postgresql.conf
copy "C:\Program Files\PostgreSQL\15\data\postgresql.conf" postgresql.conf.backup

# Backup pg_hba.conf
copy "C:\Program Files\PostgreSQL\15\data\pg_hba.conf" pg_hba.conf.backup
```

---

## Next Steps

1. ✅ PostgreSQL installed
2. ✅ Database created
3. ✅ Connection tested
4. → Update .env file
5. → Run `npm install`
6. → Run `npm run dev`
7. → Run `npm run test:db`
8. → Start syncing data!

See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) for complete setup guide.

---

**Recommended:** Option 2 (Docker) untuk development, Option 1 (Installer) untuk production.
