-- Clean up duplicate items in purchase_invoice_items before applying constraints

BEGIN;

-- Step 1: Remove duplicate items (keep only the latest one per invoice_number, branch_id)
DELETE FROM purchase_invoice_items
WHERE id NOT IN (
  SELECT MAX(id)
  FROM purchase_invoice_items
  WHERE invoice_number IS NOT NULL AND branch_id IS NOT NULL
  GROUP BY invoice_number, branch_id
);

-- Step 2: Remove items with null invoice_number or branch_id
DELETE FROM purchase_invoice_items
WHERE invoice_number IS NULL OR branch_id IS NULL;

COMMIT;
