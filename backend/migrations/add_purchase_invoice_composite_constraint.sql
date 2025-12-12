-- Add composite unique constraint to purchase_invoices table

BEGIN;

-- Add composite unique constraint on (invoice_number, branch_id)
ALTER TABLE purchase_invoices 
ADD CONSTRAINT purchase_invoices_invoice_number_branch_id_key 
UNIQUE (invoice_number, branch_id);

COMMIT;
