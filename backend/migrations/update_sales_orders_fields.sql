-- Add missing fields to sales_orders table
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS customer_address TEXT;

-- Add missing fields to sales_order_items table
ALTER TABLE sales_order_items 
ADD COLUMN IF NOT EXISTS warehouse_address TEXT,
ADD COLUMN IF NOT EXISTS item_notes TEXT;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sales_orders_po_number ON sales_orders(po_number);

COMMENT ON COLUMN sales_orders.po_number IS 'Customer PO Number';
COMMENT ON COLUMN sales_orders.customer_address IS 'Customer Ship Address';
COMMENT ON COLUMN sales_order_items.warehouse_address IS 'Warehouse Address';
COMMENT ON COLUMN sales_order_items.item_notes IS 'Item Notes/Keterangan per item';
