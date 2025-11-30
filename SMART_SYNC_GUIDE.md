# Smart Sync Feature - Only Sync What's Needed

## Overview
Smart Sync adalah fitur untuk sync data secara intelligent - hanya sync invoice yang baru atau yang berubah, skip yang sudah sama.

---

## How It Works

### 1. **Check Sync Status**
Compare data di Accurate API vs Database PostgreSQL:

```
API: 450 invoices
DB:  320 invoices

Categorize:
- New: 100 invoices (di API, tidak di DB)
- Updated: 30 invoices (di API & DB, tapi optLock berbeda)
- Unchanged: 320 invoices (sama persis)

Need Sync: 130 invoices (100 new + 30 updated)
```

### 2. **Smart Sync**
2 mode:
- **Missing Only:** Sync 130 invoices (new + updated) → Cepat!
- **Re-sync All:** Sync 450 invoices (semua) → Lengkap!

### 3. **Change Detection**
Pakai field `optLock` dari Accurate API:
- `optLock` = version number
- Setiap update di Accurate, `optLock` increment
- Compare: `API.optLock > DB.optLock` = Updated!

---

## API Endpoints

### Check Sync Status
```
GET /api/sales-invoices/check-sync
Query: branchId, dateFrom, dateTo, dateFilterType

Response:
{
  "success": true,
  "summary": {
    "total": 450,
    "new": 100,
    "updated": 30,
    "unchanged": 320,
    "needSync": 130
  },
  "invoices": {
    "new": [
      { "id": 123, "number": "INV-001", "optLock": 5 },
      ...
    ],
    "updated": [
      { "id": 456, "number": "INV-002", "optLock": 8, "dbOptLock": 5 },
      ...
    ]
  },
  "recommendation": "sync_needed"
}
```

### Smart Sync
```
POST /api/sales-invoices/sync-smart
Query: branchId, dateFrom, dateTo, mode, batchSize, batchDelay

mode: 'missing' | 'all'
- missing: Sync only new + updated
- all: Re-sync everything

Response:
{
  "success": true,
  "summary": {
    "checked": {
      "total": 450,
      "new": 100,
      "updated": 30,
      "unchanged": 320
    },
    "synced": 128,
    "errors": 2,
    "skipped": 320,
    "duration": "45.2s"
  }
}
```

---

## Frontend UI

### Workflow:

1. **Pilih Cabang & Tanggal**
   - Default: Hari ini
   - Bisa ubah range

2. **Check Sync Status**
   - Klik "🔍 Check Sync Status"
   - Tampil:
     ```
     🆕 New: 100
     🔄 Updated: 30
     ✅ Unchanged: 320
     📊 Total: 450
     
     ⚠️ Need to sync: 130 invoices
     
     New Invoices: INV-001, INV-002, ... +80 more
     Updated Invoices: INV-100, INV-101, ... +10 more
     ```

3. **Sync**
   - **⚡ Sync Missing (130)** - Cepat, sync yang perlu aja
   - **🔄 Re-sync All (450)** - Lengkap, sync semua

4. **Monitor Progress**
   - Progress bar
   - Status update
   - Duration

5. **Result**
   - Synced: 128
   - Errors: 2
   - Skipped: 320
   - Duration: 45.2s

---

## Benefits

### ✅ Faster Sync
- Skip unchanged data
- Only fetch & save what's needed
- Example: 450 invoices, only sync 130 → 3x faster!

### ✅ Bandwidth Efficient
- Less API calls
- Less data transfer
- Less database writes

### ✅ Change Detection
- Detect updates in Accurate
- Re-sync modified invoices
- Keep data fresh

### ✅ User Control
- See what will be synced before sync
- Choose: missing only or all
- Transparent process

---

## Technical Details

### Database Query
```sql
-- Get existing invoices with optLock
SELECT 
  invoice_id,
  invoice_number,
  raw_data->>'optLock' as opt_lock,
  updated_at
FROM sales_invoices 
WHERE branch_id = $1 
  AND trans_date BETWEEN $2 AND $3
```

### Comparison Logic
```javascript
for (const apiInv of apiInvoices) {
  const dbInv = dbMap.get(apiInv.id);
  
  if (!dbInv) {
    // Not in DB → New
    newInvoices.push(apiInv);
  } else {
    // In DB → Check optLock
    if (apiInv.optLock > dbInv.opt_lock) {
      // Modified → Updated
      updatedInvoices.push(apiInv);
    } else {
      // Same → Unchanged
      unchangedInvoices.push(apiInv);
    }
  }
}
```

### Sync Process
```javascript
// 1. Check sync status
const checkResult = await checkSyncStatus();

// 2. Get IDs to sync
const idsToSync = mode === 'missing' 
  ? [...newIds, ...updatedIds]  // 130 invoices
  : allIds;                      // 450 invoices

// 3. Fetch details in batches
for (let batch of batches) {
  const details = await fetchDetails(batch);
  await saveToDatabase(details);
}
```

---

## Performance

### Scenario: 5000 Invoices, 500 New/Updated

**Without Smart Sync:**
- Fetch: 5000 invoices
- Save: 5000 invoices (with UPSERT)
- Time: ~15 minutes

**With Smart Sync (Missing Only):**
- Check: 5000 invoices (list only, fast)
- Fetch: 500 invoices (details)
- Save: 500 invoices
- Time: ~3 minutes

**Improvement: 5x faster!**

---

## Use Cases

### Daily Sync
```
Mode: Missing Only
- Sync new invoices from today
- Update modified invoices
- Skip unchanged (most of them)
```

### Initial Sync
```
Mode: All
- First time sync
- Sync everything
- Build complete database
```

### Re-sync After Error
```
Mode: Missing Only
- Check what's missing
- Sync only gaps
- Fix incomplete data
```

### Verify Data Integrity
```
1. Check sync status
2. If needSync > 0 → Something missing
3. Sync missing
4. Check again → Should be 0
```

---

## Best Practices

### 1. Always Check First
```
❌ Don't: Sync blindly
✅ Do: Check sync status → See what's needed → Sync
```

### 2. Use Missing Only for Regular Sync
```
Daily sync: Missing Only (faster)
Weekly full sync: Re-sync All (ensure completeness)
```

### 3. Monitor Unchanged Count
```
If unchanged = 0 → First sync or data changed a lot
If unchanged = most → Normal, efficient sync
```

### 4. Handle Errors
```
If errors > 0:
- Check error messages
- Re-sync those specific invoices
- Investigate API issues
```

---

## Troubleshooting

### Check shows 0 new, but data missing?
- Check date range (might be outside range)
- Check branch ID (might be wrong branch)
- Check database (might be in different branch_id)

### Updated count too high?
- optLock might increment for minor changes
- Normal behavior, just re-sync them
- They'll be skipped next time if unchanged

### Sync missing fails?
- Check API credentials
- Check network connection
- Try smaller batch size
- Check backend logs

---

## Future Improvements

- [ ] Selective sync by invoice number
- [ ] Sync only specific date range within result
- [ ] Export missing invoice list to CSV
- [ ] Schedule auto-sync missing daily
- [ ] Notification when new invoices detected
- [ ] Diff view (show what changed in updated invoices)

---

## Files Changed

**Backend:**
- `backend/models/salesInvoiceModel.js` - Added `getExistingForSync()`
- `backend/services/accurateService.js` - Added `fetchListOnly()`
- `backend/controllers/salesInvoiceController.js` - Added `checkSyncStatus()` & `syncSmart()`
- `backend/routes/api.js` - Added routes

**Frontend:**
- `frontend/src/services/apiService.js` - Added `checkSyncStatus()` & `syncSmart()`
- `frontend/src/components/SyncManager.vue` - Updated UI & logic

**Documentation:**
- `SMART_SYNC_GUIDE.md` (this file)

---

## Summary

Smart Sync = **Intelligent + Efficient + Transparent**

✅ Only sync what's needed
✅ Detect changes automatically  
✅ Show what will be synced
✅ User control (missing vs all)
✅ Much faster for regular sync

**Result:** Save time, bandwidth, and database resources!
