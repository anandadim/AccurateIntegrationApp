const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
    user: 'postgres',
  host: 'localhost',
  database: 'accurate_db',
  password: 'postgres',
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections (16 cabang + buffer)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize database tables
const initialize = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Table untuk sales invoice headers
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_invoices (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL,
        invoice_number VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50) NOT NULL,
        branch_name VARCHAR(100),
        trans_date DATE NOT NULL,
        customer_id VARCHAR(50),
        customer_name VARCHAR(255),
        salesman_id VARCHAR(50),
        salesman_name VARCHAR(100),
        warehouse_id VARCHAR(50),
        warehouse_name VARCHAR(100),
        subtotal DECIMAL(15,2),
        discount DECIMAL(15,2),
        tax DECIMAL(15,2),
        total DECIMAL(15,2) NOT NULL,
        payment_status VARCHAR(20) DEFAULT 'UNPAID',
        due_date DATE,
        remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(invoice_id, branch_id)
      )
    `);

    // Add payment_status column if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sales_invoices' AND column_name='payment_status') THEN
          ALTER TABLE sales_invoices 
          ADD COLUMN payment_status VARCHAR(20) DEFAULT 'UNPAID';
        END IF;
      END $$;
    `);

    // Add due_date column if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sales_invoices' AND column_name='due_date') THEN
          ALTER TABLE sales_invoices 
          ADD COLUMN due_date DATE;
        END IF;
      END $$;
    `);

    // Add remaining_amount column if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sales_invoices' AND column_name='remaining_amount') THEN
          ALTER TABLE sales_invoices 
          ADD COLUMN remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0;
        END IF;
      END $$;
    `);

    // Indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_branch_date 
      ON sales_invoices(branch_id, trans_date)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_customer 
      ON sales_invoices(customer_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoice_number 
      ON sales_invoices(invoice_number)
    `);

    // Add warehouse_name column to sales_invoice_items if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sales_invoice_items' AND column_name='warehouse_name') THEN
          ALTER TABLE sales_invoice_items 
          ADD COLUMN warehouse_name VARCHAR(100);
        END IF;
      END $$;
    `);

    // Add salesman_name column to sales_invoice_items if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sales_invoice_items' AND column_name='salesman_name') THEN
          ALTER TABLE sales_invoice_items 
          ADD COLUMN salesman_name VARCHAR(100);
        END IF;
      END $$;
    `);

    // Add item_category column to sales_invoice_items if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='sales_invoice_items' AND column_name='item_category') THEN
          ALTER TABLE sales_invoice_items 
          ADD COLUMN item_category VARCHAR(100);
        END IF;
      END $$;
    `);

    // Table untuk sales invoice items (detail)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id INTEGER NOT NULL,
        branch_id VARCHAR(50) NOT NULL,
        item_no VARCHAR(100) NOT NULL,
        item_name TEXT,
        item_category VARCHAR(100),
        warehouse_name VARCHAR(100),
        salesman_name VARCHAR(100),
        quantity DECIMAL(15,2) NOT NULL,
        unit_name VARCHAR(50),
        unit_price DECIMAL(15,2) NOT NULL,
        discount DECIMAL(15,2) DEFAULT 0,
        amount DECIMAL(15,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoice_items 
      ON sales_invoice_items(invoice_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_item_no 
      ON sales_invoice_items(item_no)
    `);

    // Create purchase_invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id SERIAL PRIMARY KEY,
        invoice_id BIGINT UNIQUE NOT NULL,
        invoice_number VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50) NOT NULL,
        branch_name VARCHAR(255),
        trans_date DATE,
        created_date DATE,
        vendor_no VARCHAR(50),
        vendor_name VARCHAR(255),
        bill_number VARCHAR(50),
        age INTEGER,
        warehouse_id VARCHAR(50),
        warehouse_name VARCHAR(255),
        subtotal DECIMAL(15,2) DEFAULT 0,
        discount DECIMAL(15,2) DEFAULT 0,
        tax DECIMAL(15,2) DEFAULT 0,
        total DECIMAL(15,2) DEFAULT 0,
        status_name VARCHAR(50),
        created_by VARCHAR(255),
        opt_lock INTEGER DEFAULT 0,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create purchase_invoice_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id BIGINT NOT NULL,
        branch_id VARCHAR(50),
        item_no VARCHAR(50),
        item_name VARCHAR(255),
        quantity DECIMAL(15,2) DEFAULT 0,
        unit_name VARCHAR(50),
        unit_price DECIMAL(15,2) DEFAULT 0,
        discount DECIMAL(15,2) DEFAULT 0,
        amount DECIMAL(15,2) DEFAULT 0,
        warehouse_name VARCHAR(255),
        item_category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(invoice_id) ON DELETE CASCADE
      )
    `);

    // Create indexes for purchase invoices
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_invoices_branch 
      ON purchase_invoices(branch_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date 
      ON purchase_invoices(trans_date)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice 
      ON purchase_invoice_items(invoice_id)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_item 
      ON purchase_invoice_items(item_no)
    `);

    // Create trigger for updated_at
    await client.query(`
      CREATE OR REPLACE FUNCTION update_purchase_invoices_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger 
          WHERE tgname = 'trigger_purchase_invoices_updated_at'
        ) THEN
          CREATE TRIGGER trigger_purchase_invoices_updated_at
          BEFORE UPDATE ON purchase_invoices
          FOR EACH ROW
          EXECUTE FUNCTION update_purchase_invoices_updated_at();
        END IF;
      END $$;
    `);

    // Create items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        item_id BIGINT NOT NULL,
        item_no VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        category_name VARCHAR(100),
        item_category_id BIGINT,
        type VARCHAR(50),
        stock DECIMAL(15,2) DEFAULT 0,
        warehouse VARCHAR(100) NOT NULL DEFAULT '',
        unit_name VARCHAR(50),
        brand VARCHAR(100),
        tax_included BOOLEAN DEFAULT false,
        tax1_rate DECIMAL(10,2) DEFAULT 0,
        tax2_rate DECIMAL(10,2) DEFAULT 0,
        suspended BOOLEAN DEFAULT false,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(item_id)
      )
    `);

    // Migration: Add stock column if it doesn't exist, remove barcode column if it exists
    try {
      // Check if barcode column exists and drop it
      const barcodeColumnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'barcode'
      `);
      
      if (barcodeColumnCheck.rows.length > 0) {
        await client.query(`ALTER TABLE items DROP COLUMN IF EXISTS barcode`);
        console.log('✅ Dropped barcode column from items table');
      }

      // Check if stock column exists, if not add it
      const stockColumnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'stock'
      `);
      
      if (stockColumnCheck.rows.length === 0) {
        await client.query(`ALTER TABLE items ADD COLUMN stock DECIMAL(15,2) DEFAULT 0`);
        console.log('✅ Added stock column to items table');
      }

      // Check if item_category_id column exists, if not add it
      const itemCategoryIdColumnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'item_category_id'
      `);

      if (itemCategoryIdColumnCheck.rows.length === 0) {
        await client.query(`ALTER TABLE items ADD COLUMN item_category_id BIGINT`);
        console.log('✅ Added item_category_id column to items table');
      }

      // Check if suspended column exists, if not add it
      const suspendedColumnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'suspended'
      `);

      if (suspendedColumnCheck.rows.length === 0) {
        await client.query(`ALTER TABLE items ADD COLUMN suspended BOOLEAN DEFAULT false`);
        console.log('✅ Added suspended column to items table');
      }

      // Check if warehouse column exists, if not add it
      const warehouseColumnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'items' AND column_name = 'warehouse'
      `);
      
      if (warehouseColumnCheck.rows.length === 0) {
        await client.query(`ALTER TABLE items ADD COLUMN warehouse VARCHAR(100) NOT NULL DEFAULT ''`);
        console.log('✅ Added warehouse column to items table');
      }
    } catch (migrationError) {
      console.log('⚠️ Migration error (non-critical):', migrationError.message);
    }

    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        customer_id BIGINT NOT NULL,
        customer_no VARCHAR(100),
        name VARCHAR(255),
        branch_id VARCHAR(50),
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100),
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_id, branch_id)
      )
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)');

    // Add new columns if not exists
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='discount_cat_id') THEN
          ALTER TABLE customers ADD COLUMN discount_cat_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='category_name') THEN
          ALTER TABLE customers ADD COLUMN category_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='salesman_id') THEN
          ALTER TABLE customers ADD COLUMN salesman_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='salesman_name') THEN
          ALTER TABLE customers ADD COLUMN salesman_name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='created_date') THEN
          ALTER TABLE customers ADD COLUMN created_date TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='updated_date') THEN
          ALTER TABLE customers ADD COLUMN updated_date TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='suspended') THEN
          ALTER TABLE customers ADD COLUMN suspended BOOLEAN DEFAULT FALSE;
        END IF;
        -- keep old column check
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='category_id') THEN
          ALTER TABLE customers ADD COLUMN category_id BIGINT;
        END IF;
      END $$;
    `);

    // Create warehouse_stock table to track item stock per warehouse
    await client.query(`
      CREATE TABLE IF NOT EXISTS warehouse_stock (
        id SERIAL PRIMARY KEY,
        item_id BIGINT NOT NULL,
        warehouse_id VARCHAR(50) NOT NULL,
        warehouse_name VARCHAR(100),
        stock_quantity DECIMAL(15,2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
        UNIQUE(item_id, warehouse_id)
      )
    `);

    // Create indexes for better query performance
    await client.query('CREATE INDEX IF NOT EXISTS idx_items_item_no ON items(item_no)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_warehouse_stock_item ON warehouse_stock(item_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_warehouse_stock_warehouse ON warehouse_stock(warehouse_id)');

    // Table untuk API logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        branch_id VARCHAR(50),
        status INTEGER,
        response_time INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint 
      ON api_logs(endpoint, created_at)
    `);

    // Create warehouse table
    await client.query(`
      CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        warehouse_id VARCHAR(50) NOT NULL,
        warehouse_name VARCHAR(100) NOT NULL,
        location_id VARCHAR(50),
        pic VARCHAR(100),
        suspended BOOLEAN DEFAULT false,
        default_warehouse BOOLEAN DEFAULT false,
        scrap_warehouse BOOLEAN DEFAULT false,
        description TEXT,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(warehouse_id)
      )
    `);

    // Table untuk cache data (backward compatibility)
    await client.query(`
      CREATE TABLE IF NOT EXISTS accurate_data (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        branch_id VARCHAR(50),
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('Database tables initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

const query = (text, params) => pool.query(text, params);

// Get a client from pool
const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  getClient,
  initialize
};
