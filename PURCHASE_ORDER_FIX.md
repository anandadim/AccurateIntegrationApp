# Purchase Order Data Integrity Fix

## Problem
Data dengan `order_id` yang sama dari branch berbeda saling menimpa karena constraint `UNIQUE` hanya pada `order_id` saja.

### Contoh Masalah:
- Branch 3: order_id `150` dengan order_number `PO.2025.05.00002`
- Branch 3: order_id `150` dengan order_number `PO.2025.05.00001` (menimpa data sebelumnya)

Ini terjadi karena:
1. Accurate API mengembalikan `order_id` yang sama untuk order yang sama di setiap branch
2. Database constraint `UNIQUE (order_id)` tidak memungkinkan order_id yang sama meskipun dari branch berbeda
3. Data lama tertimpa oleh data baru

## Solution

### 1. Database Migration
File: `backend/migrations/fix_purchase_orders_unique_constraint.sql`

Perubahan:
- ❌ Hapus: `UNIQUE (order_id)` - terlalu ketat
- ✅ Tambah: `UNIQUE (order_id, branch_id)` - composite key

Ini memungkinkan:
- ✅ order_id `150` di branch 3 (bersama dengan order_number `PO.2025.05.00002`)
- ✅ order_id `150` di branch 2 (order yang sama tapi dari branch berbeda)
- ✅ order_id `150` di branch 1 (order yang sama tapi dari branch berbeda)

### 2. Model Update
File: `backend/models/purchaseOrderModel.js`

Perubahan di `create()` method:
```javascript
// Sebelum:
ON CONFLICT (order_id)

// Sesudah:
ON CONFLICT (order_id, branch_id)
```

## Implementation Steps

### Step 1: Backup Database
```bash
pg_dump -U postgres -d accurate_db > backup_before_fix.sql
```

### Step 2: Run Migration
```bash
psql -U postgres -d accurate_db -f backend/migrations/fix_purchase_orders_unique_constraint.sql
```

### Step 3: Verify
```sql
-- Check constraint
\d purchase_orders

-- Should show:
-- Indexes:
--     "purchase_orders_pkey" PRIMARY KEY, btree (id)
--     "purchase_orders_order_id_branch_id_key" UNIQUE, btree (order_id, branch_id)
```

### Step 4: Re-sync Data
```bash
# Clear old data (optional, jika ingin fresh start)
DELETE FROM purchase_orders;
DELETE FROM purchase_order_items;

# Atau sync ulang dari Accurate API
# Gunakan Purchase Order Sync di frontend
```

## Data Integrity
Setelah fix ini:
- ✅ Setiap branch dapat memiliki order_id yang sama
- ✅ Data tidak akan saling menimpa
- ✅ Foreign key tetap valid dengan composite constraint
- ✅ Sync detection (opt_lock) tetap akurat per branch

## Verification Query
```sql
-- Lihat data per branch
SELECT branch_id, branch_name, order_id, order_number, COUNT(*) 
FROM purchase_orders 
GROUP BY branch_id, branch_name, order_id, order_number
ORDER BY order_id, branch_id;

-- Harus menunjukkan order_id yang sama di branch berbeda
-- Contoh:
-- branch_id | branch_name | order_id | order_number | count
-- ----------|-------------|----------|--------------|------
-- branch-1  | Cabang 1    | 150      | PO.2025.05.00002 | 1
-- branch-2  | Cabang 2    | 150      | PO.2025.05.00001 | 1
-- branch-3  | Cabang 3    | 150      | PO.2025.05.00003 | 1
```

## Related Files Modified
1. `backend/migrations/fix_purchase_orders_unique_constraint.sql` - New migration
2. `backend/models/purchaseOrderModel.js` - Updated ON CONFLICT clause

## Status
✅ Fix ready for deployment
✅ Backward compatible (existing data will be preserved)
✅ No application code changes needed (only model query)
