-- Clean up all old constraints and create new ones based on order_number

BEGIN;

-- Step 1: Drop ALL constraints from purchase_order_items
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_id_branch_id_fkey;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_id_fkey;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_number_branch_id_fkey;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_id_branch_id_key;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_number_branch_id_key;

-- Step 2: Drop ALL constraints from purchase_orders (except primary key)
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_order_id_branch_id_key;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_order_number_branch_id_key;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_order_id_key;

-- Step 3: Clean up duplicate items (keep only latest per order_number, branch_id)
DELETE FROM purchase_order_items
WHERE id NOT IN (
  SELECT MAX(id)
  FROM purchase_order_items
  GROUP BY order_number, branch_id
);

-- Step 4: Delete items with NULL order_number
DELETE FROM purchase_order_items WHERE order_number IS NULL;

-- Step 5: Add composite UNIQUE constraint on purchase_orders (order_number, branch_id)
ALTER TABLE purchase_orders 
ADD CONSTRAINT purchase_orders_order_number_branch_id_key 
UNIQUE (order_number, branch_id);

-- Step 6: Add composite UNIQUE constraint on purchase_order_items (order_number, branch_id)
ALTER TABLE purchase_order_items 
ADD CONSTRAINT purchase_order_items_order_number_branch_id_key 
UNIQUE (order_number, branch_id);

-- Step 7: Add composite foreign key on purchase_order_items
ALTER TABLE purchase_order_items 
ADD CONSTRAINT purchase_order_items_order_number_branch_id_fkey 
FOREIGN KEY (order_number, branch_id) REFERENCES purchase_orders(order_number, branch_id) ON DELETE CASCADE;

COMMIT;
