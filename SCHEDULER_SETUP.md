# Scheduler Setup Guide

## Overview

Scheduler telah diimplementasikan untuk otomatisasi sync data dari SRP (SNJ Merch) dan Accurate Online API. Scheduler berjalan otomatis setiap 10 menit (default) dan dapat dikonfigurasi melalui environment variables.

## Environment Variables

### SRP Scheduler Settings

```bash
# Cron expression untuk schedule (default: setiap 10 menit)
SRP_SCHEDULER_CRON="*/10 * * * *"

# Enable/disable SRP scheduler modules
SRP_SCHEDULER_ENABLE_INVENTORY="true"      # Sync inventory data
SRP_SCHEDULER_ENABLE_SALES_DETAIL="true"   # Sync sales detail data

# Delay untuk sales detail sync (ms)
SRP_SCHEDULER_SALES_DELAY_MS="0"

# Timeout untuk setiap job (ms)
SRP_SCHEDULER_JOB_TIMEOUT_MS="300000"       # 5 menit

# Menandai running logs sebagai stale setelah (menit)
SRP_SCHEDULER_STALE_MINUTES="90"

# Scheduler state saat startup (default: false = auto-start)
SRP_SCHEDULER_DEFAULT_PAUSED="false"
```

### Accurate Scheduler Settings

```bash
# Enable/disable Accurate scheduler keseluruhan
ACCURATE_SCHEDULER_ENABLE="true"

# Enable/disable setiap endpoint
ACCURATE_SCHEDULER_ENABLE_SALES_INVOICE="true"
ACCURATE_SCHEDULER_ENABLE_SALES_RECEIPT="true"
ACCURATE_SCHEDULER_ENABLE_SALES_ORDER="true"

# Batch processing settings
ACCURATE_SCHEDULER_BATCH_SIZE="50"          # Jumlah item per batch
ACCURATE_SCHEDULER_BATCH_DELAY="300"        # Delay antar batch (ms)
```

## Scheduler Flow

### SRP Scheduler (SNJ Merch)
1. **Inventory Sync**: Mengambil data inventory dari SRP API berdasarkan storage location
2. **Sales Detail Sync**: Mengambil data sales detail per store code per hari

### Accurate Scheduler
1. **Sales Invoice Sync**: Mengambil sales invoice dari Accurate API (createdDate)
2. **Sales Receipt Sync**: Mengambil sales receipt dari Accurate API (createdDate)
3. **Sales Order Sync**: Mengambil sales order dari Accurate API (transDate)

## Auto-Initialization

Scheduler otomatis diinisialisasi saat server start:
- Jika `SRP_SCHEDULER_DEFAULT_PAUSED=false`, scheduler akan langsung berjalan
- Jika `SRP_SCHEDULER_DEFAULT_PAUSED=true`, scheduler perlu di-resume manual

## API Endpoints untuk Scheduler Control

### SRP Scheduler
```bash
# Cek status scheduler
GET /api/srp/scheduler/status

# Pause scheduler
POST /api/srp/scheduler/pause

# Resume scheduler
POST /api/srp/scheduler/resume

# Run manual scheduler
POST /api/srp/scheduler/run-now

# View logs
GET /api/srp/logs
```

### Accurate Scheduler
```bash
# View logs dengan filter
GET /api/accurate/scheduler/logs?limit=20&status=success&dataType=sales-invoice&branchId=1

# Filter options:
# - limit: jumlah logs (default: 20)
# - status: success, failed, running, timeout (bisa multiple: success,failed)
# - dataType: sales-invoice, sales-receipt, sales-order
# - branchId: filter per branch
```

## Frontend Monitoring

### SrpActivityTicker (Unified View)
- **Single Panel**: Menampilkan gabungan log SRP dan Accurate secara kronologis
- **Real-time Updates**: Refresh otomatis setiap 10 detik
- **Badge Status**: Menampilkan status scheduler SRP (running / paused / ready)
- **Log Payload**: Memuat informasi branch/store, target date, rows fetched, metadata, dan error message (jika ada)
- **Minimize/Expand**: Tetap dapat di-minimize via floating toggle button
- **Full Log Modal**: 
  - Menampilkan hingga 100 entri gabungan SRP + Accurate
  - Data ditata berdasarkan timestamp terbaru
  - Metadata Accurate (batch info, dbId, dll) ditampilkan di payload JSON

## Contoh Konfigurasi

### Development (Minimal)
```bash
# .env
SRP_SCHEDULER_CRON="*/5 * * * *"           # Setiap 5 menit
SRP_SCHEDULER_ENABLE_INVENTORY="true"
SRP_SCHEDULER_ENABLE_SALES_DETAIL="false"
ACCURATE_SCHEDULER_ENABLE="false"
SRP_SCHEDULER_DEFAULT_PAUSED="true"        # Manual control
```

### Production (Complete)
```bash
# .env
SRP_SCHEDULER_CRON="*/10 * * * *"          # Setiap 10 menit
SRP_SCHEDULER_ENABLE_INVENTORY="true"
SRP_SCHEDULER_ENABLE_SALES_DETAIL="true"
ACCURATE_SCHEDULER_ENABLE="true"
ACCURATE_SCHEDULER_ENABLE_SALES_INVOICE="true"
ACCURATE_SCHEDULER_ENABLE_SALES_RECEIPT="true"
ACCURATE_SCHEDULER_ENABLE_SALES_ORDER="true"
ACCURATE_SCHEDULER_BATCH_SIZE="100"
ACCURATE_SCHEDULER_BATCH_DELAY="500"
SRP_SCHEDULER_DEFAULT_PAUSED="false"       # Auto-start
```

## Monitoring

Scheduler logs akan menampilkan:
- 🚀 Start scheduler run
- 📋 Jumlah branches yang diproses
- 🔁 Setiap job yang berjalan
- ✅ Job completion dengan jumlah data
- ❌ Error jika ada

## Troubleshooting

### Scheduler tidak berjalan otomatis
1. Cek `SRP_SCHEDULER_DEFAULT_PAUSED` setting
2. Pastikan server berhasil start dengan melihat console logs
3. Cek endpoint `/api/srp/scheduler/status`

### Job timeout
1. Increase `SRP_SCHEDULER_JOB_TIMEOUT_MS`
2. Reduce `ACCURATE_SCHEDULER_BATCH_SIZE`
3. Increase `ACCURATE_SCHEDULER_BATCH_DELAY`

### Tidak ada data yang tersync
1. Pastikan branches configuration benar
2. Cek API credentials
3. Verify enable flags untuk setiap module

## Cron Expression Examples

```bash
# Setiap menit
"* * * * *"

# Setiap 5 menit
"*/5 * * * *"

# Setiap 10 menit
"*/10 * * * *"

# Setiap jam di menit ke-0
"0 * * * *"

# Setiap jam di menit ke-30
"30 * * * *"

# Setiap jam 8 pagi
"0 8 * * *"

# Setiap hari jam 8 pagi dan 4 sore
"0 8,16 * * *"
```
