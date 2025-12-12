-- Remove unnecessary UNIQUE constraint from purchase_order_items
-- One order can have multiple items, so (order_number, branch_id) should not be unique at item level

BEGIN;

-- Drop the problematic UNIQUE constraint
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_order_number_branch_id_key;

-- Keep only the foreign key constraint
-- (order_number, branch_id) should reference purchase_orders

COMMIT;
