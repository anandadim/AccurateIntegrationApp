-- Purchase Invoices Header Table
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id SERIAL PRIMARY KEY,
  invoice_id BIGINT UNIQUE NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  branch_name VARCHAR(255),
  
  -- Dates
  trans_date DATE,
  created_date DATE,
  
  -- Vendor/Supplier
  vendor_no VARCHAR(50),
  vendor_name VARCHAR(255),
  
  -- Bill Info
  bill_number VARCHAR(50),
  age INTEGER,
  
  -- Warehouse
  warehouse_id VARCHAR(50),
  warehouse_name VARCHAR(255),
  
  -- Amounts
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  tax DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  
  -- Status
  status_name VARCHAR(50),
  
  -- User Info
  created_by VARCHAR(255),
  
  -- Metadata
  opt_lock INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Purchase Invoice Items Table
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL,
  branch_id VARCHAR(50),
  
  -- Item info
  item_no VARCHAR(50),
  item_name VARCHAR(255),
  
  -- Quantity & Price
  quantity DECIMAL(15,2) DEFAULT 0,
  unit_name VARCHAR(50),
  unit_price DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  amount DECIMAL(15,2) DEFAULT 0,
  
  -- Additional
  warehouse_name VARCHAR(255),
  item_category VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(invoice_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_branch ON purchase_invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(trans_date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_vendor ON purchase_invoices(vendor_no);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status_name);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_number ON purchase_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice ON purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_item ON purchase_invoice_items(item_no);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_purchase_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_purchase_invoices_updated_at
  BEFORE UPDATE ON purchase_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_invoices_updated_at();
