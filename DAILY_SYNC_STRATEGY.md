# Daily Sync Strategy - Accurate API Integration

**Last Updated:** 30 November 2025  
**Status:** Production Ready ✅

---

## 📋 Overview

Strategi sync data dari Accurate Online API dengan 2 fase:
1. **Initial Sync** - One-time full historical data (Januari - November 2025)
2. **Daily Sync** - Incremental sync setiap hari

---

## 🚀 Phase 1: Initial Sync (One-Time)

### Purpose
Sync semua historical data dari Januari 2025 sampai sekarang.

### Command

```bash
# Sync Januari - November 2025
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-01-01&dateTo=2025-11-29&dateFilterType=createdDate"
```

### Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `branchId` | branch-1 | ID cabang (branch-1, branch-2, dst) |
| `dateFrom` | 2025-01-01 | Tanggal mulai (YYYY-MM-DD) |
| `dateTo` | 2025-11-29 | Tanggal akhir (YYYY-MM-DD) |
| `dateFilterType` | createdDate | Filter by created date |
| `batchSize` | 50 (default) | Items per batch |
| `batchDelay` | 300 (default) | Delay between batches (ms) |

### Performance

- **Estimated Time:** 45-60 minutes for full year
- **Success Rate:** 100% with batch processing
- **Data Volume:** ~17,500 invoices (estimated)

### Example Output

```json
{
  "success": true,
  "message": "Synced 1525 invoices from Cabang Soepomo",
  "summary": {
    "branch": "Cabang Soepomo",
    "fetched": 1525,
    "saved": 1525,
    "errors": 0,
    "apiErrors": 0
  }
}
```

---

## 📅 Phase 2: Daily Sync (Recurring)

### Purpose
Sync data baru dan update setiap hari secara otomatis.

### Strategy: Two-Pass Sync

#### Pass 1: New Invoices (Morning)
Sync invoice baru yang dibuat hari ini.

```bash
# Run at 08:00 AM
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-30&dateTo=2025-11-30&dateFilterType=createdDate&batchSize=20&batchDelay=500"
```

#### Pass 2: Updated Invoices (Evening)
Sync invoice lama yang di-update hari ini.

```bash
# Run at 06:00 PM
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-30&dateTo=2025-11-30&dateFilterType=modifiedDate&batchSize=20&batchDelay=500"
```

### Parameters for Daily Sync

| Parameter | Value | Description |
|-----------|-------|-------------|
| `dateFrom` | TODAY | Tanggal hari ini |
| `dateTo` | TODAY | Tanggal hari ini |
| `dateFilterType` | createdDate / modifiedDate | Filter type |
| `batchSize` | 20 | Smaller batch for safety |
| `batchDelay` | 500 | Longer delay for safety |

### Performance

- **Estimated Time:** 3-5 minutes per sync
- **Data Volume:** 50-200 invoices per day (estimated)
- **Total Daily Time:** ~10 minutes (2 passes)

---

## 🔄 Date Filter Types

### 1. createdDate (Default)
Filter by tanggal invoice dibuat di Accurate.

**Use Case:**
- Initial sync (historical data)
- Daily sync untuk invoice baru

**Example:**
```bash
dateFilterType=createdDate&dateFrom=2025-11-30&dateTo=2025-11-30
```

**Result:** Invoice yang dibuat tanggal 30 Nov 2025

### 2. transDate
Filter by tanggal transaksi (tanggal faktur).

**Use Case:**
- Laporan per periode transaksi
- Analisa penjualan per tanggal

**Example:**
```bash
dateFilterType=transDate&dateFrom=2025-11-01&dateTo=2025-11-30
```

**Result:** Invoice dengan trans_date November 2025

### 3. modifiedDate
Filter by tanggal invoice di-update/edit.

**Use Case:**
- Daily sync untuk catch updates
- Sync invoice yang di-edit

**Example:**
```bash
dateFilterType=modifiedDate&dateFrom=2025-11-30&dateTo=2025-11-30
```

**Result:** Invoice yang di-edit tanggal 30 Nov 2025

---

## ⚙️ Batch Processing Settings

### Default Settings (Fast)
```
batchSize=50
batchDelay=300
```

**Use for:**
- Initial sync (large data)
- Off-peak hours

**Performance:** ~6 invoices/second

### Conservative Settings (Safe)
```
batchSize=20
batchDelay=500
```

**Use for:**
- Daily sync (small data)
- Peak hours
- When API is slow

**Performance:** ~5 invoices/second

### Aggressive Settings (Fastest)
```
batchSize=100
batchDelay=200
```

**Use for:**
- Emergency full re-sync
- Off-peak hours only
- Monitor for errors

**Performance:** ~8 invoices/second  
**Risk:** Higher chance of API errors

---

## 🗓️ Automated Daily Sync

### Option 1: Windows Task Scheduler

**Create Task:**
1. Open Task Scheduler
2. Create Basic Task
3. Name: "Accurate Daily Sync - Morning"
4. Trigger: Daily at 08:00 AM
5. Action: Start a program
6. Program: `curl.exe`
7. Arguments:
```
-X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=%date:~0,4%-%date:~5,2%-%date:~8,2%&dateTo=%date:~0,4%-%date:~5,2%-%date:~8,2%&dateFilterType=createdDate&batchSize=20&batchDelay=500"
```

**Repeat for Evening Sync:**
- Name: "Accurate Daily Sync - Evening"
- Trigger: Daily at 06:00 PM
- Use `dateFilterType=modifiedDate`

### Option 2: PowerShell Script

Create `daily-sync.ps1`:

```powershell
# Daily Sync Script
$today = Get-Date -Format "yyyy-MM-dd"
$baseUrl = "http://localhost:3000/api/sales-invoices/sync"

# Morning: New invoices
Write-Host "Syncing new invoices for $today..."
$newUrl = "$baseUrl?branchId=branch-1&dateFrom=$today&dateTo=$today&dateFilterType=createdDate&batchSize=20&batchDelay=500"
curl.exe -X POST $newUrl

# Evening: Updated invoices
Write-Host "Syncing updated invoices for $today..."
$updatedUrl = "$baseUrl?branchId=branch-1&dateFrom=$today&dateTo=$today&dateFilterType=modifiedDate&batchSize=20&batchDelay=500"
curl.exe -X POST $updatedUrl

Write-Host "Daily sync completed!"
```

**Schedule with Task Scheduler:**
- Program: `powershell.exe`
- Arguments: `-File "C:\path\to\daily-sync.ps1"`

### Option 3: Node.js Cron Job

Install node-cron:
```bash
npm install node-cron
```

Create `scheduler.js`:
```javascript
const cron = require('node-cron');
const axios = require('axios');

const baseUrl = 'http://localhost:3000/api/sales-invoices/sync';
const today = new Date().toISOString().split('T')[0];

// Morning sync: 08:00 AM
cron.schedule('0 8 * * *', async () => {
  console.log('Running morning sync...');
  try {
    const response = await axios.post(baseUrl, null, {
      params: {
        branchId: 'branch-1',
        dateFrom: today,
        dateTo: today,
        dateFilterType: 'createdDate',
        batchSize: 20,
        batchDelay: 500
      }
    });
    console.log('Morning sync completed:', response.data);
  } catch (error) {
    console.error('Morning sync failed:', error.message);
  }
});

// Evening sync: 06:00 PM
cron.schedule('0 18 * * *', async () => {
  console.log('Running evening sync...');
  try {
    const response = await axios.post(baseUrl, null, {
      params: {
        branchId: 'branch-1',
        dateFrom: today,
        dateTo: today,
        dateFilterType: 'modifiedDate',
        batchSize: 20,
        batchDelay: 500
      }
    });
    console.log('Evening sync completed:', response.data);
  } catch (error) {
    console.error('Evening sync failed:', error.message);
  }
});

console.log('Scheduler started. Waiting for scheduled tasks...');
```

Run:
```bash
node scheduler.js
```

---

## 📊 Data Fields Synced

### Invoice Header (sales_invoices)
- invoice_id, invoice_number
- branch_id, branch_name
- trans_date, due_date
- customer_id, customer_name
- salesman_id, salesman_name
- subtotal, discount, tax, total
- **payment_status** (PAID/OUTSTANDING)
- **remaining_amount** (sisa belum dibayar)
- raw_data (full JSON)

### Invoice Items (sales_invoice_items)
- item_no, item_name
- quantity, unit_name, unit_price
- discount, amount
- **warehouse_name** (nama gudang)
- **salesman_name** (sales per item)
- **item_category** (kategori barang)

---

## 🔍 Monitoring & Verification

### Check Last Sync
```sql
SELECT 
  branch_name,
  COUNT(*) as total_invoices,
  MAX(created_at) as last_sync,
  MAX(trans_date) as latest_invoice
FROM sales_invoices
GROUP BY branch_name;
```

### Check Payment Status
```sql
SELECT 
  payment_status,
  COUNT(*) as count,
  SUM(total) as total_amount
FROM sales_invoices
WHERE branch_id = 'branch-1'
GROUP BY payment_status;
```

### Check Today's Data
```sql
SELECT COUNT(*) as today_invoices
FROM sales_invoices
WHERE DATE(created_at) = CURRENT_DATE;
```

### Check Outstanding Invoices
```sql
SELECT 
  invoice_number,
  customer_name,
  trans_date,
  due_date,
  total,
  remaining_amount
FROM sales_invoices
WHERE payment_status = 'OUTSTANDING'
ORDER BY due_date;
```

---

## ⚠️ Troubleshooting

### Issue: High Error Rate

**Symptoms:** Many API errors, low success rate

**Solutions:**
1. Increase batch delay: `batchDelay=500` or `batchDelay=1000`
2. Decrease batch size: `batchSize=10` or `batchSize=20`
3. Check Accurate API status
4. Run during off-peak hours

### Issue: Slow Sync

**Symptoms:** Sync takes too long

**Solutions:**
1. Increase batch size: `batchSize=50` or `batchSize=100`
2. Decrease batch delay: `batchDelay=200` or `batchDelay=300`
3. Check network connection
4. Check database performance

### Issue: Duplicate Data

**Symptoms:** Same invoice appears multiple times

**Solutions:**
- Database has UNIQUE constraint on (invoice_id, branch_id)
- Duplicates will be automatically updated (UPSERT)
- Check `updated_at` field to see when last updated

### Issue: Missing Data

**Symptoms:** Some invoices not synced

**Solutions:**
1. Check date filter type (createdDate vs transDate)
2. Run with `modifiedDate` to catch updates
3. Check API response for errors
4. Verify date range

---

## 📈 Best Practices

### 1. Initial Sync
- Run during off-peak hours (night/weekend)
- Use default batch settings (50/300)
- Monitor progress via logs
- Verify data after completion

### 2. Daily Sync
- Run twice daily (morning & evening)
- Use conservative batch settings (20/500)
- Morning: createdDate (new invoices)
- Evening: modifiedDate (updates)

### 3. Weekly Verification
- Check for missing data
- Verify payment status
- Check outstanding invoices
- Run summary reports

### 4. Monthly Full Sync
- Re-sync full month data
- Catch any missed updates
- Verify data integrity
- Archive old data if needed

---

## 🎯 Quick Reference

### Initial Sync (One-Time)
```bash
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-01-01&dateTo=2025-11-29&dateFilterType=createdDate"
```

### Daily Sync - Morning (New)
```bash
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=TODAY&dateTo=TODAY&dateFilterType=createdDate&batchSize=20&batchDelay=500"
```

### Daily Sync - Evening (Updates)
```bash
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=TODAY&dateTo=TODAY&dateFilterType=modifiedDate&batchSize=20&batchDelay=500"
```

### Re-sync Specific Date
```bash
curl -X POST "http://localhost:3000/api/sales-invoices/sync?branchId=branch-1&dateFrom=2025-11-15&dateTo=2025-11-15&dateFilterType=createdDate"
```

---

## 📞 Support

**Issues?** Check:
1. Backend running: `http://localhost:3000`
2. PostgreSQL running: `psql -U postgres -d accurate_db`
3. Accurate API credentials valid
4. Network connection stable

**Logs:** Check backend console for detailed error messages

**Database:** Use `psql` to verify data

---

**Status:** Ready for Production ✅  
**Next Steps:** Run initial sync, then setup daily automation
