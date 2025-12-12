-- Verify the fix result

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
SELECT 'Sample items from branch-3:' as check_type;
SELECT order_number, branch_id, item_no, item_name, quantity
FROM purchase_order_items
WHERE branch_id = 'branch-3'
LIMIT 10;

SELECT '' as blank;
SELECT 'Sample items from branch-9:' as check_type;
SELECT order_number, branch_id, item_no, item_name, quantity
FROM purchase_order_items
WHERE branch_id = 'branch-9'
LIMIT 10;
