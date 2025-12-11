-- Verify the fix was applied correctly

-- Check constraints on purchase_orders
SELECT 'purchase_orders constraints:' as check_type;
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name='purchase_orders' 
ORDER BY constraint_name;

-- Check constraints on purchase_order_items
SELECT '' as blank;
SELECT 'purchase_order_items constraints:' as check_type;
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name='purchase_order_items' 
ORDER BY constraint_name;

-- Check data integrity
SELECT '' as blank;
SELECT 'Data integrity check:' as check_type;
SELECT 
  COUNT(*) as total_orders,
  COUNT(DISTINCT order_id) as unique_order_ids,
  COUNT(DISTINCT (order_id, branch_id)) as unique_order_branch_pairs
FROM purchase_orders;

-- Show sample data with same order_id across branches
SELECT '' as blank;
SELECT 'Sample: Same order_id across different branches:' as check_type;
SELECT order_id, branch_id, branch_name, order_number, COUNT(*) as count
FROM purchase_orders
GROUP BY order_id, branch_id, branch_name, order_number
HAVING COUNT(*) > 0
ORDER BY order_id, branch_id
LIMIT 20;
