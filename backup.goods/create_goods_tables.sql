-- Goods Header Table
CREATE TABLE IF NOT EXISTS goods (
  id SERIAL PRIMARY KEY,
  goods_id BIGINT UNIQUE NOT NULL,
  goods_no VARCHAR(50) NOT NULL,
  goods_name VARCHAR(255) NOT NULL,
  short_name VARCHAR(255),
  
  -- Category
  category_id VARCHAR(50),
  category_name VARCHAR(255),
  
  -- Unit
  unit1_id VARCHAR(50),
  unit1_name VARCHAR(50),
  unit1_price DECIMAL(15,2) DEFAULT 0,
  
  -- Pricing
  cost DECIMAL(15,2) DEFAULT 0,
  unit_price DECIMAL(15,2) DEFAULT 0,
  
  -- Status & Type
  item_type VARCHAR(50),
  suspended BOOLEAN DEFAULT false,
  
  -- Metadata
  opt_lock INTEGER DEFAULT 0,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Goods Warehouse Details Table
CREATE TABLE IF NOT EXISTS goods_warehouse_details (
  id SERIAL PRIMARY KEY,
  goods_id BIGINT NOT NULL,
  
  -- Warehouse info
  warehouse_id VARCHAR(50),
  warehouse_name VARCHAR(255),
  location_id VARCHAR(50),
  
  -- Quantities
  unit1_quantity DECIMAL(15,2) DEFAULT 0,
  balance DECIMAL(15,2) DEFAULT 0,
  balance_unit VARCHAR(50),
  
  -- Status
  default_warehouse BOOLEAN DEFAULT false,
  scrap_warehouse BOOLEAN DEFAULT false,
  suspended BOOLEAN DEFAULT false,
  
  -- Additional
  description TEXT,
  pic VARCHAR(255),
  
  opt_lock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (goods_id) REFERENCES goods(goods_id) ON DELETE CASCADE
);

-- Goods Selling Price Details Table
CREATE TABLE IF NOT EXISTS goods_selling_prices (
  id SERIAL PRIMARY KEY,
  goods_id BIGINT NOT NULL,
  
  -- Price info
  unit_id VARCHAR(50),
  unit_name VARCHAR(50),
  price DECIMAL(15,2) DEFAULT 0,
  
  -- Category & Currency
  price_category_id VARCHAR(50),
  price_category_name VARCHAR(255),
  currency_code VARCHAR(10),
  currency_symbol VARCHAR(10),
  
  -- Branch
  branch_id VARCHAR(50),
  branch_name VARCHAR(255),
  
  -- Dates
  effective_date DATE,
  
  opt_lock INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (goods_id) REFERENCES goods(goods_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_goods_no ON goods(goods_no);
CREATE INDEX IF NOT EXISTS idx_goods_category ON goods(category_id);
CREATE INDEX IF NOT EXISTS idx_goods_type ON goods(item_type);
CREATE INDEX IF NOT EXISTS idx_goods_suspended ON goods(suspended);
CREATE INDEX IF NOT EXISTS idx_goods_warehouse_details_goods ON goods_warehouse_details(goods_id);
CREATE INDEX IF NOT EXISTS idx_goods_warehouse_details_warehouse ON goods_warehouse_details(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_goods_selling_prices_goods ON goods_selling_prices(goods_id);
CREATE INDEX IF NOT EXISTS idx_goods_selling_prices_category ON goods_selling_prices(price_category_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_goods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_goods_updated_at
  BEFORE UPDATE ON goods
  FOR EACH ROW
  EXECUTE FUNCTION update_goods_updated_at();
