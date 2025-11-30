-- Sales Orders Header Table
CREATE TABLE IF NOT EXISTS sales_orders (
  id SERIAL PRIMARY KEY,
  order_id BIGINT UNIQUE NOT NULL,
  order_number VARCHAR(50) NOT NULL,
  branch_id VARCHAR(50) NOT NULL,
  branch_name VARCHAR(255),
  
  -- Dates
  trans_date DATE,
  delivery_date DATE,
  
  -- Customer
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),
  
  -- Salesman
  salesman_id VARCHAR(50),
  salesman_name VARCHAR(255),
  
  -- Warehouse
  warehouse_id VARCHAR(50),
  warehouse_name VARCHAR(255),
  
  -- Amounts
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  tax DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  
  -- Status
  order_status VARCHAR(50),
  
  -- Metadata
  opt_lock INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales Order Items Table
CREATE TABLE IF NOT EXISTS sales_order_items (
  id SERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL,
  
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
  salesman_name VARCHAR(255),
  item_category VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (order_id) REFERENCES sales_orders(order_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_branch ON sales_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(trans_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_item ON sales_order_items(item_no);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_sales_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_orders_updated_at();
