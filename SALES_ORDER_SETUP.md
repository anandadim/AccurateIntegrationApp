# Sales Order Setup & Testing Guide

## 📋 Setup Steps

### 1. Create Database Tables

Run the migration SQL:

```bash
psql -U postgres -d accurate_integration -f backend/migrations/create_sales_orders_tables.sql
```

Or manually execute the SQL in pgAdmin/DBeaver.

### 2. Restart Backend

```bash
# Stop backend (Ctrl+C)
# Start backend
npm run dev
```

### 3. Verify Endpoints

Check if endpoints are available:

```bash
# Test endpoint
curl http://localhost:3000/api/test

# Should return: {"message":"API routes working"}
```

---

## 🎨 Frontend UI

Frontend sudah include Sales Order Sync UI dengan fitur:
- ✅ Check sync status
- ✅ Smart sync (missing only / re-sync all)
- ✅ Progress tracking
- ✅ Error handling
- ✅ Same UX as Sales Invoice

**Access:** http://localhost:5173 → Tab "📦 Sales Order Sync"

---

## 🧪 Testing with Postman/Thunder Client

### Test 1: Check Sync Status

**Endpoint:** `GET /api/sales-orders/check-sync`

**Query Params:**
```
branchId: branch-1
dateFrom: 2025-11-01
dateTo: 2025-11-30
dateFilterType: transDate
```

**Expected Response:**
```json
{
  "success": true,
  "branch": {
    "id": "branch-1",
    "name": "Cabang Soepomo"
  },
  "summary": {
    "total": 150,
    "new": 150,
    "updated": 0,
    "unchanged": 0,
    "needSync": 150
  }
}
```

### Test 2: Smart Sync (Missing Only)

**Endpoint:** `POST /api/sales-orders/sync-smart`

**Query Params:**
```
branchId: branch-1
dateFrom: 2025-11-01
dateTo: 2025-11-30
dateFilterType: transDate
batchSize: 20
batchDelay: 500
mode: missing
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Smart sync completed for Cabang Soepomo",
  "summary": {
    "synced": 145,
    "fetchErrors": 5,
    "saveErrors": 0,
    "totalErrors": 5,
    "duration": "45.2s"
  }
}
```

### Test 3: Get Orders from Database

**Endpoint:** `GET /api/sales-orders`

**Query Params:**
```
branchId: branch-1
dateFrom: 2025-11-01
dateTo: 2025-11-30
limit: 10
```

**Expected Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "order_id": 12345,
      "order_number": "SO-001",
      "trans_date": "2025-11-15",
      "customer_name": "PT ABC",
      "total": 5000000
    }
  ]
}
```

---

## 🎯 Testing Checklist for Cabang Soepomo

- [ ] Database tables created successfully
- [ ] Backend restarted without errors
- [ ] Check sync status returns data
- [ ] Smart sync completes successfully
- [ ] Data appears in database
- [ ] Can query orders from database
- [ ] Order details include items

---

## 📊 Verify Data in Database

```sql
-- Check total orders
SELECT COUNT(*) FROM sales_orders WHERE branch_id = 'branch-1';

-- Check orders by date
SELECT 
  order_number, 
  trans_date, 
  customer_name, 
  total,
  order_status
FROM sales_orders 
WHERE branch_id = 'branch-1'
  AND trans_date >= '2025-11-01'
  AND trans_date <= '2025-11-30'
ORDER BY trans_date DESC
LIMIT 10;

-- Check order items
SELECT 
  so.order_number,
  soi.item_name,
  soi.quantity,
  soi.unit_price,
  soi.amount
FROM sales_orders so
JOIN sales_order_items soi ON so.order_id = soi.order_id
WHERE so.branch_id = 'branch-1'
LIMIT 20;
```

---

## 🐛 Troubleshooting

### Error: "Table does not exist"
→ Run migration SQL first

### Error: "Branch not found"
→ Check `branchId` is correct (branch-1 for Soepomo)

### Error: "502 Bad Gateway"
→ Reduce batch size to 10, increase delay to 1000ms

### Error: "JDBC Connection"
→ Wait 5-10 minutes, retry with smaller batch

---

## ✅ Success Criteria

1. ✅ Check sync shows correct count
2. ✅ Smart sync completes with <10% error rate
3. ✅ Data visible in database
4. ✅ Order items linked correctly
5. ✅ Can query and filter orders

---

## 🚀 Next Steps After Testing

If test successful:
1. Test with other branches (Medan, Kelapa Gading)
2. Add frontend UI for Sales Order
3. Implement bulk sync (all branches)
4. Add export to JSON feature

---

## 📝 Notes

- Default date filter: `transDate` (order date)
- Batch size: 20 (recommended)
- Batch delay: 500ms (recommended)
- Retry: 2 attempts for failed requests
- Same retry mechanism as Sales Invoice
