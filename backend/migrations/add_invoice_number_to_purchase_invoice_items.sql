-- Add invoice_number column to purchase_invoice_items table

BEGIN;

-- Step 1: Add invoice_number column if not exists
ALTER TABLE purchase_invoice_items ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50);
ALTER TABLE purchase_invoice_items ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50);

-- Step 2: Populate invoice_number and branch_id from purchase_invoices
UPDATE purchase_invoice_items pii
SET invoice_number = pi.invoice_number,
    branch_id = pi.branch_id
FROM purchase_invoices pi
WHERE pii.invoice_id = pi.invoice_id;

COMMIT;
