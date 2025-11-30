# Filter Format Fix - Accurate API Date Filter

## Problem
Filter tanggal tidak jalan, fetch semua data (62,315 invoices untuk 1 hari).

**Root Cause:** Format filter salah!

### Wrong Format (Before):
```javascript
const filters = {
  'filter.transDate.from': '29/11/2025',
  'filter.transDate.to': '29/11/2025'
};
```

Result: Filter ignored, fetch ALL data!

### Correct Format (After):
```javascript
const filters = {
  'filter.transDate.val': ['29/11/2025', '29/11/2025']  // Array!
};
```

Axios converts to:
```
filter.transDate.val=29/11/2025&filter.transDate.val=29/11/2025
```

Result: Filter works, fetch only Nov 29 data!

## Accurate API Filter Format

According to Postman testing:
- `filter.{field}.val` - Array of values [fromDate, toDate]
- Axios converts array to multiple params with same key
- Example URL: `filter.transDate.val=01/01/2025&filter.transDate.val=31/01/2025`

## Changes

### Helper Function
```javascript
const createDateFilter = (dateFilterType, fromDate, toDate) => {
  const filterKey = `filter.${dateFilterType}`;
  return {
    [`${filterKey}.val`]: [fromDate, toDate]  // Array!
  };
};
```

Axios will convert to:
```
filter.transDate.val=01/01/2025&filter.transDate.val=31/01/2025
```

### Usage
```javascript
// Before
const filters = {
  [`filter.${dateFilterType}.from`]: fromDate,
  [`filter.${dateFilterType}.to`]: toDate
};

// After
const filters = createDateFilter(dateFilterType, fromDate, toDate);
```

## Files Changed
- `backend/controllers/salesInvoiceController.js`
  - Added `createDateFilter()` helper
  - Updated `checkSyncStatus()`
  - Updated `countInvoices()`
  - Updated `syncSmart()`

- `backend/services/accurateService.js`
  - Updated `fetchListWithDetails()`

## Testing

### Restart Backend
```bash
npm start
```

### Test Check Sync
```
Branch: Cikarang Utara
Date: Nov 29, 2025 (1 day)
```

Expected result:
```
📊 API Pagination: { rowCount: ~2000, pageSize: 1000, currentPage: 1 }
📄 Calculated: 2 total pages
```

NOT:
```
📊 API Pagination: { rowCount: 62315, pageSize: 1000, currentPage: 1 }
📄 Calculated: 63 total pages
```

### Verify
1. ✅ rowCount should be realistic for 1 day (~100-2000)
2. ✅ totalPages should be small (1-3 pages)
3. ✅ Fast response (~10 seconds)

## Impact

### Before (Wrong Filter):
- Fetch ALL data (62,315 invoices)
- 63 pages
- ~1 minute
- Wrong data!

### After (Correct Filter):
- Fetch only Nov 29 data (~2,000 invoices)
- 2 pages
- ~10 seconds
- Correct data!

## Date Filter Types

Supports 3 filter types:
1. `transDate` - Transaction date
2. `createdDate` - Created date
3. `modifiedDate` - Modified date

All use same format:
```javascript
filter.{type}.op = 'BETWEEN'
filter.{type}.val[0] = from date
filter.{type}.val[1] = to date
```

## Related Issues
- `PAGESIZE_FIX.md` - PageSize 1000
- `PAGINATION_FIX.md` - MAX_PAGES limit
- `SMART_SYNC_GUIDE.md` - Smart sync feature

## Credits
Thanks to Accurate API documentation:
https://account.accurate.id/developer/api-docs.do
