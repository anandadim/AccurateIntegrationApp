# Frontend Purchase Invoice Guide

## Overview

Frontend untuk Purchase Invoices telah diimplementasikan dengan pola yang sama seperti Sales Invoices. Terdapat dua komponen utama:

1. **PurchaseInvoiceSync.vue** - Sync Manager untuk sinkronisasi data
2. **PurchaseInvoiceTable.vue** - Tabel untuk menampilkan data

---

## Components

### 1. PurchaseInvoiceSync.vue

**Location:** `frontend/src/components/PurchaseInvoiceSync.vue`

**Fungsi:** Mengelola sinkronisasi purchase invoices dari Accurate API ke database lokal.

**Features:**
- ✅ Branch selection
- ✅ Date range filtering
- ✅ Sync status checking
- ✅ Batch processing configuration
- ✅ Monthly sync helper
- ✅ Progress tracking
- ✅ Error handling

**Usage:**
```vue
<template>
  <PurchaseInvoiceSync :branches="branches" />
</template>

<script>
import PurchaseInvoiceSync from './components/PurchaseInvoiceSync.vue'

export default {
  components: {
    PurchaseInvoiceSync
  }
}
</script>
```

**Props:**
- `branches` (Array, required) - List of available branches

**Key Methods:**
- `checkSync()` - Check sync status between API and database
- `syncInvoices()` - Sync invoices from Accurate API
- `syncMonth(month)` - Sync specific month
- `syncAllMonths()` - Sync all months

---

### 2. PurchaseInvoiceTable.vue

**Location:** `frontend/src/components/PurchaseInvoiceTable.vue`

**Fungsi:** Menampilkan data purchase invoices dalam format tabel.

**Features:**
- ✅ Responsive table layout
- ✅ Summary statistics
- ✅ Date formatting (Indonesian locale)
- ✅ Currency formatting
- ✅ Status badges
- ✅ Loading state
- ✅ Empty state

**Usage:**
```vue
<template>
  <PurchaseInvoiceTable 
    :items="invoices"
    :summary="summary"
    :loading="loading"
  />
</template>

<script>
import PurchaseInvoiceTable from './components/PurchaseInvoiceTable.vue'

export default {
  components: {
    PurchaseInvoiceTable
  }
}
</script>
```

**Props:**
- `items` (Array, default: []) - List of purchase invoices
- `summary` (Object, default: null) - Summary statistics
- `loading` (Boolean, default: false) - Loading state

**Columns:**
| Column | Description |
|--------|-------------|
| Date / Invoice | Transaction date and invoice number |
| Vendor Details | Vendor name and vendor number |
| Item Description | Item name and item number |
| Price (Per Unit) | Unit price in Rupiah |
| Qty | Quantity with unit (e.g., KG) |
| Warehouse | Warehouse name (e.g., CIKARANG UTARA) |
| Bill Number | Bill number from Accurate |
| Status | Invoice status (POSTED, DRAFT, etc.) |
| Total | Total amount in Rupiah |

---

## API Service Methods

**Location:** `frontend/src/services/apiService.js`

### Purchase Invoice Methods

```javascript
// Check sync status
apiService.checkPurchaseInvoiceSyncStatus({
  branchId: 'BRANCH001',
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
  dateFilterType: 'createdDate'
})

// Count invoices
apiService.countPurchaseInvoices({
  branchId: 'BRANCH001',
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31'
})

// Sync invoices
apiService.syncPurchaseInvoices({
  branchId: 'BRANCH001',
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
  batchSize: 50,
  batchDelay: 300,
  streamInsert: true
})

// Get invoices
apiService.getPurchaseInvoices({
  branchId: 'BRANCH001',
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31',
  limit: 100,
  offset: 0
})

// Get summary
apiService.getPurchaseInvoiceSummary({
  branchId: 'BRANCH001',
  dateFrom: '2024-01-01',
  dateTo: '2024-01-31'
})
```

---

## Integration in App.vue

The Purchase Invoice Sync has been integrated into the main App.vue:

```vue
<template>
  <div>
    <h1>🔗 Accurate Online API Integration</h1>
    
    <div class="view-toggle">
      <!-- ... other buttons ... -->
      <button 
        @click="currentView = 'purchase-invoice-sync'" 
        :class="{ active: currentView === 'purchase-invoice-sync' }"
      >
        📦 Purchase Invoice Sync
      </button>
      <!-- ... other buttons ... -->
    </div>

    <!-- Purchase Invoice Sync View -->
    <PurchaseInvoiceSync v-if="currentView === 'purchase-invoice-sync'" :branches="branches" />
  </div>
</template>
```

---

## Usage Flow

### Step 1: Navigate to Purchase Invoice Sync
Click the "📦 Purchase Invoice Sync" button in the navigation.

### Step 2: Select Branch
Choose a branch from the dropdown menu.

### Step 3: Set Date Range
- **Dari Tanggal:** Start date (default: today)
- **Sampai Tanggal:** End date (default: today)
- **Filter Type:** Choose between:
  - `createdDate` - Filter by creation date (default)
  - `transDate` - Filter by transaction date
  - `modifiedDate` - Filter by modification date

### Step 4: Check Sync Status
Click "🔍 Check Sync Status" to see:
- **New:** Invoices not in database
- **Updated:** Invoices modified in Accurate
- **Unchanged:** Invoices already synced
- **Total:** Total invoices in Accurate

### Step 5: Configure Sync Settings
- **Batch Size:** Items per batch (10-100, default: 20)
- **Batch Delay:** Delay between batches in ms (100-1000, default: 500)
- **Stream Insert:** Insert per batch (recommended: enabled)

### Step 6: Sync Invoices
Click "⚡ Sync Invoices" to start syncing.

### Step 7: Monitor Progress
- Progress bar shows sync progress
- Status message updates in real-time
- Results displayed after completion

---

## Data Display

### Summary Table
Shows:
- Total Records
- Fetched Invoices
- Page Size

### Main Table
Displays all purchase invoice items with:
- Date and invoice number
- Vendor information
- Item details
- Pricing and quantities
- Warehouse location
- Bill number
- Status
- Total amount

### Status Badges
```
POSTED    → Green badge
DRAFT     → Yellow badge
CANCELLED → Red badge
PENDING   → Blue badge
```

---

## Formatting

### Date Format
Indonesian locale (DD MMM YYYY)
- Example: `15 Jan 2024`

### Currency Format
Indonesian Rupiah (Rp)
- Example: `Rp 1.000.000`

### Quantity Format
With 2 decimal places and unit
- Example: `100.00 KG`

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Pilih cabang terlebih dahulu" | No branch selected | Select a branch from dropdown |
| "Failed to check sync status" | API connection error | Check network and API status |
| "Failed to sync invoices" | Sync operation failed | Check server logs and retry |
| "Error syncing [Month]" | Monthly sync failed | Retry or check date range |

---

## Monthly Sync Helper

Click "📅 Sync Per Month" to enable monthly sync:

1. Select individual months to sync
2. Or click "🔄 Sync All Months" to sync all months
3. Status indicators:
   - ✅ Synced
   - ⏳ Syncing
   - (empty) Not synced

---

## Styling

The components use:
- **Framework:** Vue 3 with Composition API
- **Styling:** Scoped CSS
- **Colors:**
  - Primary: #42b983 (Green)
  - Success: #28a745 (Dark Green)
  - Info: #17a2b8 (Blue)
  - Warning: #ffc107 (Yellow)
  - Error: #dc3545 (Red)

---

## Performance Considerations

### Batch Processing
- **Default Batch Size:** 20 items
- **Default Batch Delay:** 500ms
- **Recommendation:** Use default settings for stability

### Date Range
- **Recommended:** 1 month at a time
- **Maximum:** 3 months (for faster sync)
- **Minimum:** 1 day

### Pagination
- **Default Limit:** 100 records
- **Maximum:** 1000 records
- **Offset:** For pagination support

---

## Files Modified/Created

### Created Files
- `frontend/src/components/PurchaseInvoiceSync.vue`
- `frontend/src/components/PurchaseInvoiceTable.vue`
- `FRONTEND_PURCHASE_INVOICE_GUIDE.md` (this file)

### Modified Files
- `frontend/src/App.vue` - Added Purchase Invoice components
- `frontend/src/services/apiService.js` - Added Purchase Invoice API methods

---

## Testing

### Test Endpoints

1. **Check Sync Status**
   - Select branch
   - Set date range
   - Click "Check Sync Status"
   - Verify sync status cards appear

2. **Sync Invoices**
   - Check sync status first
   - Adjust batch settings if needed
   - Click "Sync Invoices"
   - Monitor progress bar
   - Verify results

3. **View Data**
   - After sync, navigate to API Testing view
   - Fetch purchase invoices
   - Verify data displays in table

---

## Troubleshooting

### Issue: Components not showing
- Verify imports in App.vue
- Check component file paths
- Ensure components are registered

### Issue: API calls failing
- Check backend is running
- Verify API endpoints are correct
- Check network connectivity
- Review browser console for errors

### Issue: Sync taking too long
- Reduce date range
- Increase batch size (but monitor API)
- Decrease batch delay (but monitor stability)

### Issue: Data not displaying
- Check if sync completed successfully
- Verify database has data
- Check browser console for errors
- Try refreshing page

---

## Next Steps

1. **Test the sync manager** - Sync a small date range
2. **Verify data** - Check if data appears in table
3. **Integrate with dashboard** - Add purchase invoice stats
4. **Add filters** - Implement vendor filter
5. **Add export** - Export to CSV/Excel

---

## Support

For issues or questions:
1. Check this guide
2. Review backend API documentation
3. Check browser console for errors
4. Review server logs
5. Check database for data

---

**Created:** December 3, 2025
**Version:** 1.0
**Status:** Production Ready
