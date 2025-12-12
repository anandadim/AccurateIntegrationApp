-- Create composite unique constraint for purchase_invoices

BEGIN;

-- Step 1: Add composite unique constraint on (invoice_number, branch_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_invoices_invoice_number_branch_id_key'
  ) THEN
    ALTER TABLE purchase_invoices ADD CONSTRAINT purchase_invoices_invoice_number_branch_id_key UNIQUE (invoice_number, branch_id);
  END IF;
END $$;

-- Step 2: Add composite unique constraint for items on (invoice_number, branch_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'purchase_invoice_items_invoice_number_branch_id_key'
  ) THEN
    ALTER TABLE purchase_invoice_items ADD CONSTRAINT purchase_invoice_items_invoice_number_branch_id_key UNIQUE (invoice_number, branch_id);
  END IF;
END $$;

-- Step 3: Add composite foreign key using invoice_number
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
