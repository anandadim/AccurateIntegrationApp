# Frontend Guide - Sync Manager

## 🎯 Fitur Baru

Frontend sudah diupdate dengan **Sync Manager** yang memudahkan proses sync data dari Accurate API.

## 🚀 Cara Menjalankan

### 1. Start Backend
```bash
cd backend
npm start
```
Server jalan di `http://localhost:3000`

### 2. Start Frontend
```bash
cd frontend
npm run dev
```
Frontend jalan di `http://localhost:5173`

## 📱 Fitur Sync Manager

### **Tab 1: Sync Manager** 🔄
Fitur utama untuk sync sales invoice:

#### **1. Pilih Cabang**
- Dropdown list 14 cabang
- Auto-load saat buka aplikasi

#### **2. Cek Jumlah Invoice (Dry-Run)** 🔍
- Input tanggal dari & sampai
- Pilih filter type (createdDate/transDate/modifiedDate)
- Klik "Count Invoices"
- Hasil:
  - Total invoices
  - Total pages
  - Estimated time
  - Estimated API calls

**Gunakan ini sebelum sync untuk estimasi!**

#### **3. Sync Invoice** 🚀
- Setting batch size (10-100)
- Setting batch delay (100-1000ms)
- Toggle stream insert (recommended: ON)
- 2 mode sync:
  
  **A. Start Sync** - Sync sesuai range tanggal yang dipilih
  - Progress bar real-time
  - Status update
  - Result: saved, errors, duration
  
  **B. Sync Per Month** 📅
  - Klik "Sync Per Month"
  - Muncul grid 11 bulan (Jan-Nov 2025)
  - Klik bulan yang mau di-sync
  - Status per bulan:
    - ⏳ Syncing
    - ✅ Done
  - Atau klik "Sync All Months" untuk sync semua

### **Tab 2: API Testing** 🔌
Fitur lama untuk testing API:
- Get customers
- Get items
- Get sales invoices
- List + Details

## 🎨 Tampilan

### Sync Manager Features:
- ✅ Clean card-based layout
- ✅ Color-coded status (success/error/progress)
- ✅ Progress bar dengan percentage
- ✅ Monthly grid untuk sync per bulan
- ✅ Responsive design (mobile-friendly)
- ✅ Real-time feedback

### Color Scheme:
- Primary: `#42b983` (Green)
- Success: `#28a745` (Green)
- Info: `#17a2b8` (Blue)
- Warning: `#ffc107` (Yellow)
- Error: `#dc3545` (Red)

## 📊 Workflow Recommended

### **Untuk Sync Data Baru:**

1. **Pilih Cabang** (misal: Cikarang Utara)

2. **Count Dulu** (Dry-Run)
   ```
   From: 2025-01-01
   To: 2025-01-31
   Filter: createdDate
   → Klik "Count Invoices"
   ```
   
   Hasil misal:
   - Total: 450 invoices
   - Estimated time: ~27 seconds
   - API calls: 450

3. **Sync Kalau OK**
   - Batch size: 50 (default)
   - Batch delay: 300ms (default)
   - Stream insert: ON
   - Klik "Start Sync"

4. **Monitor Progress**
   - Lihat progress bar
   - Tunggu sampai selesai
   - Cek result: saved vs errors

5. **Lanjut Bulan Berikutnya**
   - Atau pakai "Sync Per Month" untuk otomatis

### **Untuk Sync Semua Cabang:**

1. Loop manual per cabang:
   - Cikarang Utara → Sync Jan-Nov
   - Medan → Sync Jan-Nov
   - dst...

2. Atau bisa dibuat script automation (future improvement)

## 🔧 Settings Optimal

### **Data Sedikit (<500 invoice):**
- Batch size: 50
- Batch delay: 300ms
- Estimated: ~30 detik

### **Data Sedang (500-2000 invoice):**
- Batch size: 50
- Batch delay: 200ms
- Estimated: 1-3 menit

### **Data Banyak (>2000 invoice):**
- Batch size: 100
- Batch delay: 100ms
- Sync per bulan (jangan sekaligus!)
- Estimated: 5-10 menit per bulan

## ⚠️ Tips & Best Practices

1. **Selalu Count Dulu** - Jangan langsung sync tanpa tau jumlahnya
2. **Sync Per Bulan** - Untuk data banyak, lebih aman per bulan
3. **Monitor Log Backend** - Lihat terminal backend untuk detail progress
4. **Jangan Refresh** - Saat sync jalan, jangan refresh browser
5. **Check Database** - Setelah sync, cek di pgAdmin untuk validasi
6. **Stream Insert ON** - Lebih aman, data langsung masuk per batch

## 🐛 Troubleshooting

### **Sync Lambat/Stuck:**
- Cek log backend di terminal
- Cek koneksi internet
- Kurangi batch size
- Tambah batch delay

### **Error Saat Sync:**
- Cek credentials di `branches.json`
- Cek database connection
- Lihat error message di frontend
- Cek log backend untuk detail

### **Data Tidak Masuk:**
- Query database: `SELECT COUNT(*) FROM sales_invoices WHERE branch_id = 'branch-2'`
- Cek `updated_at` untuk tau kapan terakhir insert
- Cek error count di result

## 📝 Future Improvements

- [ ] Real-time progress dari backend (WebSocket/SSE)
- [ ] Pause/Resume sync
- [ ] Sync history & logs
- [ ] Multi-cabang sync (parallel)
- [ ] Export data to Excel
- [ ] Dashboard analytics
- [ ] Notification system

## 🎉 Selesai!

Frontend sudah siap dipakai. Tinggal:
1. Start backend
2. Start frontend
3. Buka browser: `http://localhost:5173`
4. Pilih tab "Sync Manager"
5. Mulai sync!
