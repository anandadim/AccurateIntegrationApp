-- Add detail_id column to purchase_invoice_items for proper upsert support
BEGIN;

-- Add detail_id column to uniquely identify each line item
ALTER TABLE purchase_invoice_items ADD COLUMN IF NOT EXISTS detail_id BIGINT;

-- Create unique constraint on (invoice_id, detail_id) for proper upsert
ALTER TABLE purchase_invoice_items 
DROP CONSTRAINT IF EXISTS purchase_invoice_items_invoice_id_detail_id_key;

ALTER TABLE purchase_invoice_items 
ADD CONSTRAINT purchase_invoice_items_invoice_id_detail_id_key 
UNIQUE (invoice_id, detail_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_detail_id 
ON purchase_invoice_items(detail_id);

COMMIT;
