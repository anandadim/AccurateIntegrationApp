-- Check current data status

SELECT 'purchase_orders by branch:' as check_type;
SELECT branch_id, COUNT(*) as order_count
FROM purchase_orders
GROUP BY branch_id
ORDER BY branch_id;

SELECT '' as blank;
SELECT 'purchase_order_items by branch:' as check_type;
SELECT branch_id, COUNT(*) as item_count
FROM purchase_order_items
GROUP BY branch_id
ORDER BY branch_id;

SELECT '' as blank;
SELECT 'Orders without items:' as check_type;
SELECT po.branch_id, COUNT(*) as count
FROM purchase_orders po
LEFT JOIN purchase_order_items poi ON po.order_number = poi.order_number AND po.branch_id = poi.branch_id
WHERE poi.id IS NULL
GROUP BY po.branch_id
ORDER BY po.branch_id;

SELECT '' as blank;
SELECT 'Sample: First 5 orders from each branch:' as check_type;
SELECT po.id, po.order_number, po.branch_id, 
       COUNT(poi.id) as item_count
FROM purchase_orders po
LEFT JOIN purchase_order_items poi ON po.order_number = poi.order_number AND po.branch_id = poi.branch_id
GROUP BY po.id, po.order_number, po.branch_id
ORDER BY po.branch_id, po.id
LIMIT 20;
