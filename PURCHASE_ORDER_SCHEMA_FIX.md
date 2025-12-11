# Purchase Order Schema Fix - Using order_number as Unique Key

## Problem Statement
Data dengan `order_id` yang sama dari branch berbeda saling menimpa karena:
1. Accurate API mengembalikan `order_id` yang sama untuk order yang sama di setiap branch
2. `order_number` adalah identifier yang unik per branch
3. Constraint `UNIQUE (order_id)` terlalu ketat dan tidak mempertimbangkan multi-branch scenario

### Contoh Masalah:
```
Branch 3: order_id=150, order_number=PO.2025.05.00002 ✓
Branch 3: order_id=150, order_number=PO.2025.05.00001 ✗ (menimpa data sebelumnya)
```

## Solution
Mengubah unique constraint dari `order_id` menjadi composite key `(order_number, branch_id)`.

### Alasan:
- ✅ `order_number` sudah unik per branch (format: PO.YYYY.MM.XXXXX)
- ✅ Memungkinkan `order_id` yang sama di branch berbeda
- ✅ Data tidak akan saling menimpa
- ✅ Sync detection tetap akurat per branch

## Implementation

### 1. Database Migrations Applied

#### Migration 1: `fix_purchase_orders_unique_constraint.sql`
- Menambah kolom `branch_id` ke `purchase_order_items`
- Membuat composite constraint `(order_id, branch_id)`
- Membuat composite FK untuk items

#### Migration 2: `change_purchase_orders_pk_to_order_number.sql`
- Menambah kolom `order_number` ke `purchase_order_items`
- Mengubah constraint dari `(order_id, branch_id)` ke `(order_number, branch_id)`
- Mengubah FK dari `order_id` ke `order_number`

#### Migration 3: `cleanup_and_fix_constraints.sql` (Final)
- Membersihkan semua constraint lama
- Menghapus duplicate items
- Membuat constraint baru yang clean:
  - `purchase_orders_order_number_branch_id_key` - UNIQUE
  - `purchase_order_items_order_number_branch_id_key` - UNIQUE
  - `purchase_order_items_order_number_branch_id_fkey` - FK

### 2. Code Changes

#### `backend/models/purchaseOrderModel.js`
```javascript
// Sebelum:
ON CONFLICT (order_id, branch_id)

// Sesudah:
ON CONFLICT (order_number, branch_id)
DO UPDATE SET
  order_id = EXCLUDED.order_id,  // order_id bisa berubah
  ...
```

#### `backend/controllers/purchaseOrderController.js`
```javascript
// Sebelum:
const dbMap = new Map(dbOrders.map(o=>[o.order_id, o]));
const db = dbMap.get(api.id);

// Sesudah:
const dbMap = new Map(dbOrders.map(o=>[o.order_number, o]));
const db = dbMap.get(api.number);
```

## Database Schema After Fix

### purchase_orders
```sql
CREATE TABLE purchase_orders (
  id SERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL,           -- Can be same across branches
  order_number VARCHAR(50) NOT NULL,  -- Unique per branch
  branch_id VARCHAR(50) NOT NULL,
  branch_name VARCHAR(255),
  ...
  UNIQUE (order_number, branch_id)    -- Composite key
);
```

### purchase_order_items
```sql
CREATE TABLE purchase_order_items (
  id SERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL,
  order_number VARCHAR(50) NOT NULL,  -- Added for FK
  branch_id VARCHAR(50) NOT NULL,
  ...
  UNIQUE (order_number, branch_id),
  FOREIGN KEY (order_number, branch_id) 
    REFERENCES purchase_orders(order_number, branch_id) 
    ON DELETE CASCADE
);
```

## Data Integrity

### Before Fix
```
purchase_orders:
id | order_id | order_number | branch_id | branch_name
1  | 150      | PO.2025.05.00002 | branch-3  | Cabang 3
2  | 150      | PO.2025.05.00001 | branch-3  | Cabang 3 (DUPLICATE - overwrites id=1)

Result: Data id=1 hilang, hanya id=2 yang tersimpan
```

### After Fix
```
purchase_orders:
id | order_id | order_number | branch_id | branch_name
1  | 150      | PO.2025.05.00002 | branch-3  | Cabang 3 ✓
2  | 150      | PO.2025.05.00001 | branch-3  | Cabang 3 ✓ (berbeda order_number)
3  | 150      | PO.2025.05.00003 | branch-2  | Cabang 2 ✓ (berbeda branch)

Result: Semua data tersimpan dengan aman
```

## Verification Query

```sql
-- Lihat data per branch dengan order_id yang sama
SELECT 
  order_id, 
  order_number, 
  branch_id, 
  branch_name,
  COUNT(*) as count
FROM purchase_orders
GROUP BY order_id, order_number, branch_id, branch_name
HAVING COUNT(*) > 0
ORDER BY order_id, branch_id;

-- Expected: Setiap kombinasi (order_number, branch_id) hanya muncul 1x
```

## Sync Detection Logic

### Sebelum:
```javascript
// Menggunakan order_id sebagai key - SALAH
const dbMap = new Map(dbOrders.map(o=>[o.order_id, o]));
const db = dbMap.get(api.id);  // Bisa salah jika ada order_id duplikat
```

### Sesudah:
```javascript
// Menggunakan order_number sebagai key - BENAR
const dbMap = new Map(dbOrders.map(o=>[o.order_number, o]));
const db = dbMap.get(api.number);  // Akurat per branch
```

## Rollback Plan (jika diperlukan)

```bash
# Backup current data
pg_dump -U postgres -d accurate_db > backup_after_fix.sql

# Restore to previous state
psql -U postgres -d accurate_db < backup_before_fix.sql
```

## Testing Checklist

- [x] Migration berhasil dijalankan
- [x] Constraints sudah benar
- [x] Duplicate data sudah dihapus
- [ ] Sync Purchase Order dari Accurate API
- [ ] Verifikasi data tidak saling menimpa
- [ ] Test dengan multiple branches
- [ ] Verifikasi opt_lock sync detection

## Status

✅ **Schema Fix Complete**
- Database constraints sudah diperbaiki
- Code sudah diupdate
- Ready untuk testing

## Related Files

1. `backend/migrations/fix_purchase_orders_unique_constraint.sql`
2. `backend/migrations/change_purchase_orders_pk_to_order_number.sql`
3. `backend/migrations/cleanup_and_fix_constraints.sql`
4. `backend/models/purchaseOrderModel.js` - Updated
5. `backend/controllers/purchaseOrderController.js` - Updated
