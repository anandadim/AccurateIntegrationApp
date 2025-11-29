# Fix PostgreSQL Password Issue

## Problem

Error: `password authentication failed for user "postgres"`

PostgreSQL sudah terinstall (versi 16.8/17) tapi password tidak diketahui.

## Solution Options

### Option 1: Reset Password (Recommended)

#### Step 1: Edit pg_hba.conf

1. Buka File Explorer
2. Navigate ke folder PostgreSQL data:
   - Default: `C:\Program Files\PostgreSQL\17\data`
   - Atau: `C:\Program Files\PostgreSQL\16\data`

3. Buka file `pg_hba.conf` dengan Notepad (as Administrator)

4. Cari baris yang seperti ini:
```
# IPv4 local connections:
host    all             all             127.0.0.1/32            scram-sha-256
```

5. Ubah `scram-sha-256` menjadi `trust`:
```
# IPv4 local connections:
host    all             all             127.0.0.1/32            trust
```

6. Save file

#### Step 2: Restart PostgreSQL Service

```powershell
# Buka PowerShell as Administrator
Restart-Service postgresql-x64-17
```

Atau via Services:
1. Tekan `Win + R`
2. Ketik `services.msc`
3. Cari `postgresql-x64-17`
4. Klik kanan → Restart

#### Step 3: Connect & Reset Password

```powershell
# Connect tanpa password
psql -U postgres

# Di psql prompt, set password baru:
ALTER USER postgres PASSWORD 'postgres';

# Exit
\q
```

#### Step 4: Restore pg_hba.conf

1. Buka `pg_hba.conf` lagi
2. Ubah kembali `trust` menjadi `scram-sha-256`:
```
host    all             all             127.0.0.1/32            scram-sha-256
```
3. Save file

#### Step 5: Restart Service Lagi

```powershell
Restart-Service postgresql-x64-17
```

#### Step 6: Test Connection

```powershell
$env:PGPASSWORD='postgres'
psql -U postgres -c "SELECT version();"
```

### Option 2: Use Docker Instead (Easier)

Jika reset password terlalu ribet, gunakan Docker:

#### Step 1: Start Docker Desktop

1. Buka Docker Desktop
2. Tunggu sampai running

#### Step 2: Run PostgreSQL Container

```powershell
docker run --name postgres-accurate `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=accurate_db `
  -p 5433:5432 `
  -d postgres:15
```

Note: Menggunakan port 5433 karena 5432 sudah dipakai PostgreSQL yang terinstall.

#### Step 3: Update .env

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/accurate_db
```

Note: Port 5433, bukan 5432.

#### Step 4: Test

```powershell
npm run test:db
```

### Option 3: Uninstall & Reinstall PostgreSQL

Jika option 1 & 2 tidak berhasil:

1. Uninstall PostgreSQL dari Control Panel
2. Delete folder `C:\Program Files\PostgreSQL`
3. Delete folder `C:\Users\[YourUser]\AppData\Local\PostgreSQL`
4. Download installer baru dari https://www.postgresql.org/download/windows/
5. Install dengan password: `postgres`
6. Database name: `accurate_db`

## After Fix

### Create Database

```powershell
# Connect
psql -U postgres

# Create database
CREATE DATABASE accurate_db;

# Verify
\l

# Exit
\q
```

### Update .env

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db
```

### Test Backend

```powershell
npm run test:db
npm run dev
```

## Quick Test Commands

```powershell
# Test PostgreSQL connection
psql -U postgres -c "SELECT version();"

# Test database exists
psql -U postgres -c "\l"

# Test from Node.js
npm run test:db
```

## Troubleshooting

### Still can't connect?

Check PostgreSQL is running:
```powershell
Get-Service postgresql-x64-17
```

Should show: `Status: Running`

### Port already in use?

Check what's using port 5432:
```powershell
netstat -ano | findstr :5432
```

### Need to change port?

Edit `postgresql.conf`:
1. Location: `C:\Program Files\PostgreSQL\17\data\postgresql.conf`
2. Find: `port = 5432`
3. Change to: `port = 5433`
4. Restart service
5. Update .env: `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/accurate_db`

---

**Recommended:** Option 2 (Docker) adalah yang paling mudah dan tidak mengganggu PostgreSQL yang sudah terinstall.
