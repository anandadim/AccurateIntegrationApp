-- Sales Receipts Header Table
CREATE TABLE IF NOT EXISTS sales_receipts (
  id SERIAL PRIMARY KEY,
  receipt_id BIGINT UNIQUE NOT NULL,
  receipt_number VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  branch_name VARCHAR(255),
  
  -- Journal reference
  journal_id BIGINT,
  
  -- Dates
  trans_date DATE,
  cheque_date DATE,
  
  -- Customer
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),
  
  -- Bank / Cash account
  bank_id VARCHAR(50),
  bank_name VARCHAR(255),
  
  -- Amounts
  total_payment DECIMAL(15,2) DEFAULT 0,
  over_pay DECIMAL(15,2) DEFAULT 0,
  use_credit BOOLEAN DEFAULT FALSE,
  
  -- Payment info
  payment_method VARCHAR(50),
  cheque_no VARCHAR(100),
  description TEXT,
  
  -- Status (derived from first invoice detail)
  invoice_status VARCHAR(50),
  
  -- User info
  created_by VARCHAR(50),
  
  -- Metadata
  opt_lock INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Receipt Items Table
CREATE TABLE IF NOT EXISTS sales_receipt_items (
  id SERIAL PRIMARY KEY,
  receipt_id BIGINT NOT NULL,
  branch_id VARCHAR(50),
  
  -- Related invoice info
  invoice_id BIGINT,
  invoice_number VARCHAR(50),
  invoice_date DATE,
  invoice_total DECIMAL(15,2) DEFAULT 0,
  invoice_remaining DECIMAL(15,2) DEFAULT 0,
  
  -- Allocation values
  payment_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  
  status VARCHAR(50),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (receipt_id) REFERENCES sales_receipts(receipt_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_receipts_branch ON sales_receipts(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_date ON sales_receipts(trans_date);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_customer ON sales_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipts_receipt_number ON sales_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_sales_receipt_items_receipt ON sales_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_sales_receipt_items_invoice ON sales_receipt_items(invoice_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_sales_receipts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_receipts_updated_at
  BEFORE UPDATE ON sales_receipts
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_receipts_updated_at();
