-- Clean up orphan purchase_order_items that don't have corresponding purchase_orders
-- This happens when data gets out of sync

BEGIN;

-- Find and delete orphan items
DELETE FROM purchase_order_items poi
WHERE NOT EXISTS (
  SELECT 1 FROM purchase_orders po
  WHERE po.order_id = poi.order_id AND po.branch_id = poi.branch_id
);

-- Also delete items where branch_id is NULL
DELETE FROM purchase_order_items
WHERE branch_id IS NULL;

COMMIT;
