-- Fix purchase_order_items branch_id mapping
-- This script correctly maps branch_id based on order_number instead of order_id

BEGIN;

-- Step 1: Clear all items first (we'll rebuild from raw_data)
DELETE FROM purchase_order_items;

-- Step 2: Rebuild purchase_order_items from purchase_orders raw_data
INSERT INTO purchase_order_items (
  order_id, 
  order_number, 
  branch_id,
  item_id, 
  item_no, 
  item_name,
  quantity, 
  unit_id, 
  unit_name,
  unit_price, 
  total_price, 
  tax_rate,
  warehouse_id, 
  warehouse_name, 
  notes
)
SELECT 
  po.order_id,
  po.order_number,
  po.branch_id,
  (item->>'itemId')::VARCHAR as item_id,
  item->'item'->>'no' as item_no,
  COALESCE(item->>'detailName', item->'item'->>'name') as item_name,
  (item->>'quantity')::DECIMAL as quantity,
  (item->>'itemUnitId')::VARCHAR as unit_id,
  item->'itemUnit'->>'name' as unit_name,
  (item->>'unitPrice')::DECIMAL as unit_price,
  (item->>'totalPrice')::DECIMAL as total_price,
  (item->'tax1'->>'rate')::DECIMAL as tax_rate,
  item->'defaultWarehousePurchaseInvoice'->>'id' as warehouse_id,
  item->'defaultWarehousePurchaseInvoice'->>'name' as warehouse_name,
  item->>'detailNotes' as notes
FROM purchase_orders po,
LATERAL jsonb_array_elements(po.raw_data->'detailItem') as item
WHERE po.raw_data IS NOT NULL 
  AND po.raw_data->'detailItem' IS NOT NULL;

COMMIT;
