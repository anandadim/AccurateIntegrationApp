# Testing Guide - Phase 1

## Setup Awal

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Jalankan Backend

```bash
npm run dev
```

Backend akan berjalan di `http://localhost:3000`

### 3. Jalankan Frontend (Terminal Baru)

```bash
npm run frontend
```

Frontend akan berjalan di `http://localhost:5173`

## Testing Flow

### Step 1: Test Backend API Langsung

Buka browser atau Postman:

**Test Health Check:**
```
GET http://localhost:3000/
```

**Test Get Databases:**
```
GET http://localhost:3000/api/databases
```

Response akan berisi list database (cabang) yang tersedia.

### Step 2: Test dengan Frontend

1. Buka `http://localhost:5173` di browser
2. Klik tombol "Load Databases"
3. Pilih salah satu cabang dari dropdown
4. Klik salah satu tombol:
   - "Get Customers" - untuk data customer
   - "Get Items" - untuk data item/produk
   - "Get Sales Invoices" - untuk data invoice

### Step 3: Verifikasi Cache di SQLite

Data yang di-fetch akan otomatis tersimpan di `database/accurate.db`

Untuk melihat data di SQLite, bisa gunakan:
- DB Browser for SQLite
- SQLite CLI: `sqlite3 database/accurate.db`

Query untuk cek cache:
```sql
SELECT * FROM accurate_data;
```

## Endpoint API yang Tersedia

### GET /api/databases
Mendapatkan list database (cabang) dari Accurate Online

### GET /api/data/:endpoint?dbId=xxx
Fetch data dari Accurate API dan simpan ke cache

Contoh:
- `/api/data/customer/list?dbId=1869410`
- `/api/data/item/list?dbId=1869410`
- `/api/data/sales-invoice/list?dbId=1869410`

### GET /api/cache/:endpoint?dbId=xxx
Ambil data dari cache SQLite (tanpa hit API Accurate)

## Troubleshooting

### Error: "Failed to fetch databases"
- Cek apakah credentials di `.env` sudah benar
- Cek koneksi internet
- Cek apakah token masih valid

### Error: "Database ID required"
- Pastikan sudah pilih cabang di dropdown
- Pastikan parameter `dbId` ada di query string

### Frontend tidak bisa connect ke backend
- Pastikan backend sudah running di port 3000
- Cek proxy config di `frontend/vite.config.js`

## Next Steps

Setelah testing berhasil:
1. ✓ Confirm data bisa di-fetch dari 1 cabang
2. ✓ Confirm data tersimpan di SQLite
3. → Tambah endpoint lain sesuai kebutuhan
4. → Setup scheduler untuk auto-sync
5. → Scale ke 16 cabang
