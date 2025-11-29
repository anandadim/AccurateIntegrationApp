# Quick Start Guide

## 🚀 Langkah Cepat untuk Mulai

### 1. Install Dependencies (Pertama Kali)

```bash
# Install backend
npm install

# Install frontend
cd frontend
npm install
cd ..
```

### 2. Jalankan Aplikasi

**Terminal 1 - Backend:**
```bash
npm run dev
```
✓ Backend running di `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
npm run frontend
```
✓ Frontend running di `http://localhost:5173`

### 3. Test di Browser

1. Buka `http://localhost:5173`
2. Klik "Load Databases" untuk melihat list cabang
3. Pilih cabang dari dropdown
4. Klik tombol untuk fetch data (Customer, Items, atau Sales Invoices)
5. Lihat response data di bawah

## ✅ Checklist Testing

- [ ] Backend bisa start tanpa error
- [ ] Frontend bisa start tanpa error
- [ ] Bisa load list databases
- [ ] Bisa pilih cabang
- [ ] Bisa fetch data customer
- [ ] Data tersimpan di SQLite (`database/accurate.db`)

## 📁 File Penting

- `.env` - Credentials Accurate API (sudah terisi)
- `backend/server.js` - Entry point backend
- `frontend/src/App.vue` - Main frontend component
- `TESTING.md` - Panduan testing lengkap
- `ACCURATE_ENDPOINTS.md` - Daftar endpoint Accurate API

## 🔧 Troubleshooting Cepat

**Backend error saat start:**
- Pastikan sudah `npm install`
- Cek file `.env` ada dan terisi

**Frontend error saat start:**
- Pastikan sudah `cd frontend && npm install`
- Cek port 5173 tidak dipakai aplikasi lain

**Tidak bisa fetch data:**
- Pastikan backend sudah running
- Cek credentials di `.env` masih valid
- Lihat console browser untuk error detail

## 📞 Next Steps

Setelah berhasil test 1 cabang:
1. Tambah endpoint lain sesuai kebutuhan (lihat `ACCURATE_ENDPOINTS.md`)
2. Setup scheduler untuk auto-sync (Phase 2)
3. Tambah export CSV (Phase 3)
4. Scale ke 16 cabang (Phase 4)
