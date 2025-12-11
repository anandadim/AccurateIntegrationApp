SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'purchase_invoice_items' 
ORDER BY ordinal_position;
