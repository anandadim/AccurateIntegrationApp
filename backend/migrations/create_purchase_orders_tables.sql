-- Purchase Orders Header Table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  order_id BIGINT UNIQUE NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  branch_name VARCHAR(255),

  -- Dates
  trans_date DATE,
  ship_date DATE,

  -- Vendor / Supplier
  vendor_id VARCHAR(50),
  vendor_no VARCHAR(50),
  vendor_name VARCHAR(255),

  -- Additional details
  description TEXT,
  currency_code VARCHAR(10),
  rate DECIMAL(18,6),

  -- Amounts
  sub_total DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,

  -- Status and approval
  approval_status VARCHAR(50),
  status_name VARCHAR(50),

  -- Payments & Others
  payment_term_id VARCHAR(50),
  created_by VARCHAR(255),

  -- Metadata
  opt_lock INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Order Items Table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL,
  branch_id VARCHAR(50),

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
  warehouse_id VARCHAR(50),
  warehouse_name VARCHAR(255),
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (order_id) REFERENCES purchase_orders(order_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(trans_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_no);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status_name);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_item ON purchase_order_items(item_no);

-- Trigger for updated_at
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
