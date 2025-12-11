-- Fix Purchase Orders unique constraint to allow same order_id across different branches
-- This migration removes the UNIQUE constraint on order_id alone and replaces it with
-- a composite unique constraint on (order_id, branch_id)

BEGIN;

-- Step 1: Drop existing foreign key constraint from purchase_order_items
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_id_fkey;

-- Step 2: Add branch_id column to purchase_order_items if not exists
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);

-- Step 3: Populate branch_id in purchase_order_items from purchase_orders
UPDATE purchase_order_items poi
SET branch_id = po.branch_id
FROM purchase_orders po
WHERE poi.order_id = po.order_id AND poi.branch_id IS NULL;

-- Step 4: Remove duplicate items (keep only the latest one per order_id, branch_id)
DELETE FROM purchase_order_items
WHERE id NOT IN (
  SELECT MAX(id)
  FROM purchase_order_items
  GROUP BY order_id, branch_id
);

-- Step 5: Drop the old UNIQUE constraint on order_id only
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_order_id_key;

-- Step 6: Add composite UNIQUE constraint (order_id + branch_id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_orders_order_id_branch_id_key'
  ) THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_order_id_branch_id_key UNIQUE (order_id, branch_id);
  END IF;
END $$;

-- Step 7: Add composite UNIQUE constraint for items if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_order_items_order_id_branch_id_key'
  ) THEN
    ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_order_id_branch_id_key UNIQUE (order_id, branch_id);
  END IF;
END $$;

-- Step 8: Add new composite foreign key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_order_items_order_id_branch_id_fkey'
  ) THEN
    ALTER TABLE purchase_order_items 
    ADD CONSTRAINT purchase_order_items_order_id_branch_id_fkey 
    FOREIGN KEY (order_id, branch_id) REFERENCES purchase_orders(order_id, branch_id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
