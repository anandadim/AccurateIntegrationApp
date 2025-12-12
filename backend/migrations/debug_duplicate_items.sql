-- Debug what's causing the duplicate key error

SELECT 'Current items in database:' as debug;
SELECT order_number, branch_id, COUNT(*) as count
FROM purchase_order_items
GROUP BY order_number, branch_id
HAVING COUNT(*) > 1
ORDER BY order_number, branch_id;

SELECT '' as blank;
SELECT 'Raw data analysis for PO.2022.11.00001, branch-3:' as debug;
SELECT 
  po.id,
  po.order_number,
  po.branch_id,
  jsonb_array_length(po.raw_data->'detailItem') as item_count,
  po.raw_data->'detailItem' as items
FROM purchase_orders po
WHERE po.order_number = 'PO.2022.11.00001' AND po.branch_id = 'branch-3';

SELECT '' as blank;
SELECT 'Extracted items from raw_data:' as debug;
SELECT 
  po.order_number,
  po.branch_id,
  (item->>'itemId') as item_id,
  item->'item'->>'no' as item_no,
  COALESCE(item->>'detailName', item->'item'->>'name') as item_name
FROM purchase_orders po,
LATERAL jsonb_array_elements(po.raw_data->'detailItem') as item
WHERE po.order_number = 'PO.2022.11.00001' AND po.branch_id = 'branch-3';
