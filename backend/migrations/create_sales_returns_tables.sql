-- Sales Returns Header Table
CREATE TABLE IF NOT EXISTS sales_returns (
  id SERIAL PRIMARY KEY,
  sales_return_id BIGINT UNIQUE NOT NULL,
  return_number VARCHAR(50) NOT NULL,

  -- Branch / database context
  branch_id VARCHAR(50),
  branch_name VARCHAR(255),

  -- Dates & reference documents
  trans_date DATE,
  invoice_id BIGINT,
  invoice_number VARCHAR(50),
  return_type VARCHAR(30),

  -- Amounts
  return_amount DECIMAL(18,6) DEFAULT 0,
  sub_total DECIMAL(18,6) DEFAULT 0,
  cash_discount DECIMAL(18,6) DEFAULT 0,

  -- Misc info
  description TEXT,
  approval_status VARCHAR(50),
  customer_id BIGINT,
  po_number VARCHAR(50),
  master_salesman_id BIGINT,
  salesman_name VARCHAR(255),
  currency_code VARCHAR(10),

  -- Accounting refs
  journal_id BIGINT,

  -- Metadata
  created_by VARCHAR(50),
  opt_lock INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Return Items Table
CREATE TABLE IF NOT EXISTS sales_return_items (
  id SERIAL PRIMARY KEY,
  sales_return_id BIGINT NOT NULL,
  branch_id VARCHAR(50),

  -- Item info
  item_id BIGINT,
  item_no VARCHAR(100),
  item_name VARCHAR(255),
  quantity DECIMAL(18,6) DEFAULT 0,
  unit_name VARCHAR(30),
  unit_price DECIMAL(18,6) DEFAULT 0,
  return_amount DECIMAL(18,6) DEFAULT 0,

  -- Warehouse & costing
  cogs_gl_account_id BIGINT,
  warehouse_id BIGINT,
  warehouse_name VARCHAR(255),
  cost_item DECIMAL(18,6) DEFAULT 0,

  -- Source references
  sales_invoice_detail_id BIGINT,
  invoice_detail_quantity DECIMAL(18,6) DEFAULT 0,
  sales_order_id BIGINT,
  return_detail_status VARCHAR(50),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (sales_return_id) REFERENCES sales_returns(sales_return_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_returns_branch ON sales_returns(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON sales_returns(trans_date);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_return_number ON sales_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_header ON sales_return_items(sales_return_id);
CREATE INDEX IF NOT EXISTS idx_sales_return_items_item ON sales_return_items(item_id);

-- Trigger for updated_at column
CREATE OR REPLACE FUNCTION update_sales_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_returns_updated_at
  BEFORE UPDATE ON sales_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_returns_updated_at();
