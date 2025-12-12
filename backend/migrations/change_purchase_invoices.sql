-- Change purchase invoice primary key from invoice_id to (invoice_number, branch_id)
-- This allows same invoice_id across different branches without conflicts

BEGIN;

-- Step 1: Drop foreign key constraints from purchase_invoice_items
ALTER TABLE purchase_invoice_items DROP CONSTRAINT IF EXISTS purchase_invoice_items_invoice_id_fkey;

-- Step 2: Drop existing unique constraints
ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS purchase_invoices_invoice_id_key;

-- Step 3: Remove duplicate items (keep only the latest one per invoice_number, branch_id)
DELETE FROM purchase_invoice_items
WHERE id NOT IN (
  SELECT MAX(id)
  FROM purchase_invoice_items
  GROUP BY invoice_number, branch_id
);

-- Step 4: Add invoice_number to purchase_invoice_items if not exists
ALTER TABLE purchase_invoice_items ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);

-- Step 5: Populate invoice_number in purchase_invoice_items from purchase_invoices
UPDATE purchase_invoice_items pii
SET invoice_number = pi.invoice_number
FROM purchase_invoices pi
WHERE pii.invoice_id = pi.invoice_id AND pii.branch_id = pi.branch_id;

-- Step 6: Create composite unique constraint on (invoice_number, branch_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_invoices_invoice_number_branch_id_key'
  ) THEN
    ALTER TABLE purchase_invoices ADD CONSTRAINT purchase_invoices_invoice_number_branch_id_key UNIQUE (invoice_number, branch_id);
  END IF;
END $$;

-- Step 7: Add composite unique constraint for items on (invoice_number, branch_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_invoice_items_invoice_number_branch_id_key'
  ) THEN
    ALTER TABLE purchase_invoice_items ADD CONSTRAINT purchase_invoice_items_invoice_number_branch_id_key UNIQUE (invoice_number, branch_id);
  END IF;
END $$;

-- Step 8: Add new composite foreign key using invoice_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_invoice_items_invoice_number_branch_id_fkey'
  ) THEN
    ALTER TABLE purchase_invoice_items 
    ADD CONSTRAINT purchase_invoice_items_invoice_number_branch_id_fkey 
    FOREIGN KEY (invoice_number, branch_id) REFERENCES purchase_invoices(invoice_number, branch_id) ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
