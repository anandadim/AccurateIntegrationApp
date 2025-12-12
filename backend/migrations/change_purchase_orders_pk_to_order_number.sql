-- Change Purchase Orders primary key from order_id to order_number
-- This allows same order_id across different branches without conflicts

BEGIN;

-- Step 1: Drop foreign key constraints from purchase_order_items
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_id_branch_id_fkey;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_id_fkey;

-- Step 2: Drop existing unique constraints
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_order_id_branch_id_key;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_order_id_key;

-- Step 3: Remove duplicate items (keep only the latest one per order_number, branch_id)
DELETE FROM purchase_order_items
WHERE id NOT IN (
  SELECT MAX(id)
  FROM purchase_order_items
  GROUP BY order_id, branch_id
);

-- Step 4: Add order_number to purchase_order_items if not exists
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

-- Step 5: Populate order_number in purchase_order_items from purchase_orders
UPDATE purchase_order_items poi
SET order_number = po.order_number
FROM purchase_orders po
WHERE poi.order_id = po.order_id AND poi.branch_id = po.branch_id;

-- Step 6: Create composite unique constraint on (order_number, branch_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_orders_order_number_branch_id_key'
  ) THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_order_number_branch_id_key UNIQUE (order_number, branch_id);
  END IF;
END $$;

-- Step 7: Add composite unique constraint for items on (order_number, branch_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_order_items_order_number_branch_id_key'
  ) THEN
    ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_order_number_branch_id_key UNIQUE (order_number, branch_id);
  END IF;
END $$;

-- Step 8: Add new composite foreign key using order_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_order_items_order_number_branch_id_fkey'
  ) THEN
    ALTER TABLE purchase_order_items 
    ADD CONSTRAINT purchase_order_items_order_number_branch_id_fkey 
    FOREIGN KEY (order_number, branch_id) REFERENCES purchase_orders(order_number, branch_id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
