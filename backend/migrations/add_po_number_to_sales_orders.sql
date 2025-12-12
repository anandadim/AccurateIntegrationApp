-- Add missing columns to sales_orders and sales_order_items tables
-- These columns were missing from the original schema but are used by the controller

-- Add missing columns to sales_orders table
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS customer_address TEXT;

-- Add missing columns to sales_order_items table
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS warehouse_address TEXT;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS item_notes TEXT;

-- Add indexes for better performance if frequently queried
CREATE INDEX IF NOT EXISTS idx_sales_orders_po_number ON sales_orders(po_number);
