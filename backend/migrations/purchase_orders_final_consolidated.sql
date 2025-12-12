-- =====================================================
-- PURCHASE ORDERS FINAL CONSOLIDATED SCHEMA
-- =====================================================
-- This file consolidates all purchase order table migrations
-- into a single, optimized schema with proper constraints
-- Created: December 2025
-- Based on analysis of existing migration files
-- =====================================================

BEGIN;

-- Drop existing tables if they exist (for clean recreation)
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;

-- =====================================================
-- PURCHASE ORDERS HEADER TABLE
-- =====================================================
CREATE TABLE purchase_orders (
  -- Primary key using order_number + branch_id composite
  id SERIAL PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  
  -- Original order_id from API (kept for reference)
  order_id BIGINT NOT NULL,
  
  -- Basic info
  branch_name VARCHAR(255),
  description TEXT,
  
  -- Dates
  trans_date DATE,
  ship_date DATE,
  
  -- Vendor / Supplier information
  vendor_id VARCHAR(50),
  vendor_no VARCHAR(50),
  vendor_name VARCHAR(255),
  
  -- Currency and financial details
  currency_code VARCHAR(10),
  rate DECIMAL(18,6),
  
  -- Amounts
  sub_total DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  
  -- Status information
  approval_status VARCHAR(50),
  status_name VARCHAR(50),
  
  -- Payment terms
  payment_term_id VARCHAR(50),
  
  -- User information
  created_by VARCHAR(255),
  
  -- Metadata
  opt_lock INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Composite unique constraint (allows same order_id across different branches)
  CONSTRAINT purchase_orders_order_number_branch_id_key UNIQUE (order_number, branch_id)
);

-- =====================================================
-- PURCHASE ORDER ITEMS TABLE
-- =====================================================
CREATE TABLE purchase_order_items (
  id SERIAL PRIMARY KEY,
  
  -- References to header (using composite key)
  order_number VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  order_id BIGINT NOT NULL, -- kept for reference
  
  -- Item details
  item_id VARCHAR(50),
  item_no VARCHAR(50),
  item_name VARCHAR(255),
  quantity DECIMAL(15,2) DEFAULT 0,
  unit_id VARCHAR(50),
  unit_name VARCHAR(50),
  unit_price DECIMAL(15,2) DEFAULT 0,
  total_price DECIMAL(15,2) DEFAULT 0,
  tax_rate DECIMAL(6,2),
  
  -- Warehouse information
  warehouse_id VARCHAR(50),
  warehouse_name VARCHAR(255),
  
  -- Additional details
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Composite foreign key constraint
  CONSTRAINT purchase_order_items_order_number_branch_id_fkey 
    FOREIGN KEY (order_number, branch_id) 
    REFERENCES purchase_orders(order_number, branch_id) 
    ON DELETE CASCADE
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Purchase orders indexes
CREATE INDEX idx_purchase_orders_branch ON purchase_orders(branch_id);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(trans_date);
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders(vendor_no);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status_name);
CREATE INDEX idx_purchase_orders_order_id ON purchase_orders(order_id);
CREATE INDEX idx_purchase_orders_number ON purchase_orders(order_number);

-- Purchase order items indexes
CREATE INDEX idx_purchase_order_items_order ON purchase_order_items(order_number);
CREATE INDEX idx_purchase_order_items_item ON purchase_order_items(item_no);
CREATE INDEX idx_purchase_order_items_warehouse ON purchase_order_items(warehouse_id);
CREATE INDEX idx_purchase_order_items_order_id ON purchase_order_items(order_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for updated_at on purchase_orders
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_orders_updated_at();

-- =====================================================
-- VIEWS FOR CONVENIENT ACCESS
-- =====================================================

-- View for purchase orders with vendor details
CREATE OR REPLACE VIEW purchase_orders_detail AS
SELECT 
  po.*,
  COUNT(poi.id) as item_count,
  SUM(poi.quantity) as total_quantity,
  SUM(poi.total_price) as items_total
FROM purchase_orders po
LEFT JOIN purchase_order_items poi ON po.order_number = poi.order_number AND po.branch_id = poi.branch_id
GROUP BY po.id, po.order_number, po.branch_id, po.order_id, po.branch_name, 
         po.description, po.trans_date, po.ship_date, po.vendor_id, po.vendor_no,
         po.vendor_name, po.currency_code, po.rate, po.sub_total, po.tax_amount,
         po.total_amount, po.approval_status, po.status_name, po.payment_term_id,
         po.created_by, po.opt_lock, po.raw_data, po.created_at, po.updated_at;

-- View for items with full details
CREATE OR REPLACE VIEW purchase_order_items_detail AS
SELECT 
  poi.*,
  po.vendor_name,
  po.trans_date,
  po.status_name,
  po.created_by
FROM purchase_order_items poi
JOIN purchase_orders po ON poi.order_number = po.order_number AND poi.branch_id = po.branch_id;

COMMIT;

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
/*
Key changes made from original migrations:

1. **Primary Key Strategy**: 
   - Changed from order_id to composite key (order_number, branch_id)
   - This allows same order_id across different branches without conflicts

2. **Constraint Management**:
   - Removed unnecessary UNIQUE constraint from items table
   - One order can have multiple items, so item-level uniqueness was incorrect
   - Maintained proper foreign key relationships

3. **Data Integrity**:
   - Composite foreign key ensures referential integrity
   - Proper cascade delete for orphaned items

4. **Performance**:
   - Comprehensive indexing strategy
   - Added convenient views for common queries

5. **Migration Safety**:
   - Tables dropped and recreated cleanly
   - All constraints properly defined
   - No dependency on existing data structure

This consolidated schema represents the final, stable state
after all the constraint fixes and optimizations from the
individual migration files.
*/
