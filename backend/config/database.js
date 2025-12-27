const { Pool } = require('pg');
require('dotenv').config();

// Accurate database pool (legacy)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum connections (16 cabang + buffer)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// SNJ Merch database pool
let srpPool;
const getSrpPool = () => {
  if (!srpPool) {
    let connectionSRP = process.env.SRP_DATABASE_URL;
    if (!connectionSRP) {
      throw new Error('SRP_DATABASE_URL is not defined');
    }

    srpPool = new Pool({
      connectionString: connectionSRP,
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
      statement_timeout: 30000,
    });

    srpPool.on('connect', () => {
      console.log('Connected to SNJ PostgreSQL database');
    });

    srpPool.on('error', (err) => {
      console.error('Unexpected error on SNJ idle client', err);
      process.exit(-1);
    });
  }

  return srpPool;
};

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

    // Create purchase_invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoices (
        id SERIAL PRIMARY KEY,
        invoice_id BIGINT NOT NULL,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (invoice_id, branch_id)
      )
    `);

    // Create purchase_invoice_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id BIGINT NOT NULL,
        detail_id BIGINT,
        branch_id VARCHAR(50),
        invoice_number VARCHAR(50),
        item_no VARCHAR(50),
        seq INTEGER,
        item_name VARCHAR(255),
        quantity DECIMAL(15,2) DEFAULT 0,
        unit_name VARCHAR(50),
        unit_price DECIMAL(15,2) DEFAULT 0,
        discount DECIMAL(15,2) DEFAULT 0,
        amount DECIMAL(15,2) DEFAULT 0,
        warehouse_name VARCHAR(255),
        item_category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (invoice_id, detail_id, branch_id,seq),
        FOREIGN KEY (invoice_id, branch_id) 
        REFERENCES purchase_invoices(invoice_id, branch_id) 
        ON DELETE CASCADE
      )
    `);

    // Add missing columns to purchase_invoice_items if they don't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='purchase_invoice_items' AND column_name='detail_id') THEN
          ALTER TABLE purchase_invoice_items 
          ADD COLUMN detail_id BIGINT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='purchase_invoice_items' AND column_name='invoice_number') THEN
          ALTER TABLE purchase_invoice_items 
          ADD COLUMN invoice_number VARCHAR(50);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name='purchase_invoice_items' AND column_name='seq') THEN
          ALTER TABLE purchase_invoice_items 
          ADD COLUMN seq INTEGER;
        END IF;
      END $$;
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
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_detail_id 
      ON purchase_invoice_items(detail_id)
    `);

    // // Ensure proper constraints for upsert
    // await client.query(`
    //   DO $$
    //   BEGIN
    //     -- Fix purchase_invoices constraint
    //     IF NOT EXISTS (
    //       SELECT 1 FROM pg_constraint 
    //       WHERE conname = 'purchase_invoices_invoice_id_branch_id_key'
    //     ) THEN
    //       ALTER TABLE purchase_invoices 
    //       ADD CONSTRAINT purchase_invoices_invoice_id_branch_id_key 
    //       UNIQUE (invoice_id, branch_id);
    //     END IF;
        
    //     -- Fix purchase_invoice_items constraint
    //     IF NOT EXISTS (
    //       SELECT 1 FROM pg_constraint 
    //       WHERE conname = 'purchase_invoice_items_invoice_id_detail_id_key'
    //     ) THEN
    //       ALTER TABLE purchase_invoice_items 
    //       ADD CONSTRAINT purchase_invoice_items_invoice_id_detail_id_key 
    //       UNIQUE (invoice_id, detail_id);
    //     END IF;
    //   END $$;
    // `);

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
        branch_id VARCHAR(50) NOT NULL,
        seq INTEGER,
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
        UNIQUE(item_id,branch_id,seq)
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

    // -- Sales Receipts Header Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_receipts (
        id SERIAL PRIMARY KEY,
        receipt_id BIGINT NOT NULL,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(receipt_id,branch_id)
      );
    `);

    // -- Sales Receipt Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_receipt_items (
        id SERIAL PRIMARY KEY,
        receipt_id BIGINT NOT NULL,
        branch_id VARCHAR(50),
        seq INTEGER,
        
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
        UNIQUE(receipt_id,branch_id,seq),
        FOREIGN KEY (receipt_id,branch_id) REFERENCES sales_receipts(receipt_id,branch_id) ON DELETE CASCADE
      );
    `);

        // -- Indexes for performance
      await client.query('CREATE INDEX IF NOT EXISTS idx_sales_receipts_branch ON sales_receipts(branch_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_sales_receipts_date ON sales_receipts(trans_date)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_sales_receipts_customer ON sales_receipts(customer_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_sales_receipts_receipt_number ON sales_receipts(receipt_number)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_sales_receipt_items_receipt ON sales_receipt_items(receipt_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_sales_receipt_items_invoice ON sales_receipt_items(invoice_id)');

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
        branch_id VARCHAR(50) NOT NULL,
        seq INTEGER,
        warehouse_id VARCHAR(50) NOT NULL,
        warehouse_name VARCHAR(100),
        stock_quantity DECIMAL(15,2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id,branch_id,seq) REFERENCES items(item_id,branch_id,seq) ON DELETE CASCADE,
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

    // =====================================================
    // PURCHASE ORDERS TABLES (Final Consolidated Schema)
    // =====================================================
    
    // Create purchase_orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50),
        branch_id VARCHAR(50) NOT NULL,
        order_id BIGINT NOT NULL,
        branch_name VARCHAR(255),
        description TEXT,
        trans_date DATE,
        ship_date DATE,
        vendor_id VARCHAR(50),
        vendor_no VARCHAR(50),
        vendor_name VARCHAR(255),
        currency_code VARCHAR(10),
        rate DECIMAL(18,6),
        sub_total DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) DEFAULT 0,
        approval_status VARCHAR(50),
        status_name VARCHAR(50),
        payment_term_id VARCHAR(50),
        created_by VARCHAR(255),
        opt_lock INTEGER DEFAULT 0,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (order_id, branch_id)
      )
    `);

    // Create purchase_order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(50),
        branch_id VARCHAR(50) NOT NULL,
        order_id BIGINT NOT NULL,
        item_id VARCHAR(50),
        item_no VARCHAR(50),
        item_name VARCHAR(255),
        quantity DECIMAL(15,2) DEFAULT 0,
        unit_id VARCHAR(50),
        unit_name VARCHAR(50),
        unit_price DECIMAL(15,2) DEFAULT 0,
        total_price DECIMAL(15,2) DEFAULT 0,
        tax_rate DECIMAL(6,2),
        seq INTEGER,
        warehouse_id VARCHAR(50),
        warehouse_name VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (order_id, branch_id, order_number, seq),
        FOREIGN KEY (order_id, branch_id) 
        REFERENCES purchase_orders(order_id, branch_id) 
        ON DELETE CASCADE
      )
    `);

    // Purchase orders indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch ON purchase_orders(branch_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(trans_date)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor ON purchase_orders(vendor_no)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status_name)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_orders_order_id ON purchase_orders(order_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_orders_number ON purchase_orders(order_number)');

    // Purchase order items indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(order_number)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_order_items_item ON purchase_order_items(item_no)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_order_items_warehouse ON purchase_order_items(warehouse_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order_id ON purchase_order_items(order_id)');

    // Create trigger for updated_at on purchase_orders
    await client.query(`
      CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
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
          WHERE tgname = 'trigger_purchase_orders_updated_at'
        ) THEN
          CREATE TRIGGER trigger_purchase_orders_updated_at
          BEFORE UPDATE ON purchase_orders
          FOR EACH ROW
          EXECUTE FUNCTION update_purchase_orders_updated_at();
        END IF;
      END $$;
    `);

    // Create sales_invoice_relations table (SI ↔ SO ↔ SR mapping)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_invoice_relations (
        id SERIAL PRIMARY KEY,
        branch_id VARCHAR(50) NOT NULL,
        branch_name VARCHAR(100),
        order_number VARCHAR(50),
        order_id BIGINT,
        invoice_number VARCHAR(50),
        invoice_id BIGINT,
        trans_date DATE,
        sales_receipt VARCHAR(100) NOT NULL,
        receipt_date DATE,
        payment_id VARCHAR(50),
        payment_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(branch_id, sales_receipt)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_relations_branch ON sales_invoice_relations(branch_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_relations_invoice ON sales_invoice_relations(invoice_id)`);

    // Sales Orders Header Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id SERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL,
        order_number VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50) NOT NULL,
        branch_name VARCHAR(255),
        
        -- Dates
        trans_date DATE,
        delivery_date DATE,
        
        -- Customer
        customer_id VARCHAR(50),
        customer_name VARCHAR(255),
        customer_address TEXT,
        
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
        
        -- Additional fields
        po_number VARCHAR(100),
        
        -- Metadata
        opt_lock INTEGER DEFAULT 0,
        UNIQUE(order_id, branch_id),
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sales Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_order_items (
        id SERIAL PRIMARY KEY,
        order_id BIGINT NOT NULL,
        branch_id VARCHAR(50) NOT NULL,
        seq INTEGER,
        
        -- Item info
        item_no VARCHAR(50),
        item_name VARCHAR(255),
        item_category VARCHAR(100),
        
        -- Quantity & Price
        quantity DECIMAL(15,2) DEFAULT 0,
        unit_name VARCHAR(50),
        unit_price DECIMAL(15,2) DEFAULT 0,
        discount DECIMAL(15,2) DEFAULT 0,
        amount DECIMAL(15,2) DEFAULT 0,
        
        -- Additional
        warehouse_name VARCHAR(255),
        salesman_name VARCHAR(255),
        warehouse_address TEXT,
        item_notes TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(order_id, branch_id,seq),
        FOREIGN KEY (order_id, branch_id) REFERENCES sales_orders(order_id, branch_id) ON DELETE CASCADE
      )
    `);

    // Indexes for sales_orders
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_branch ON sales_orders(branch_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(trans_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_customer ON sales_orders(customer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(order_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_number ON sales_orders(order_number)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_po_number ON sales_orders(po_number)`);
    
    // Indexes for sales_order_items
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items(order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_order_items_item ON sales_order_items(item_no)`);

    // Trigger for updated_at on sales_orders
    await client.query(`
      CREATE OR REPLACE FUNCTION update_sales_orders_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_sales_orders_updated_at ON sales_orders
    `);

    await client.query(`
      CREATE TRIGGER trigger_sales_orders_updated_at
        BEFORE UPDATE ON sales_orders
        FOR EACH ROW
        EXECUTE FUNCTION update_sales_orders_updated_at()
    `);

    // Sales Returns Header Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        id SERIAL PRIMARY KEY,
        sales_return_id BIGINT NOT NULL,
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        UNIQUE(sales_return_id, branch_id)
      )
    `);

    // Sales Return Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales_return_items (
        id SERIAL PRIMARY KEY,
        sales_return_id BIGINT NOT NULL,
        return_number VARCHAR(50),
        branch_id VARCHAR(50),

        -- Item info
        item_id BIGINT,
        item_no VARCHAR(100),
        item_name VARCHAR(255),
        seq INTEGER,
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
        
        UNIQUE(sales_return_id, branch_id,seq)
      )
    `);

    // Indexes for sales_returns
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_returns_branch ON sales_returns(branch_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON sales_returns(trans_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON sales_returns(customer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_returns_return_number ON sales_returns(return_number)`);
    
    // Indexes for sales_return_items
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_return_items_header ON sales_return_items(sales_return_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sales_return_items_item ON sales_return_items(item_id)`);

    // Trigger for updated_at on sales_returns
    await client.query(`
      CREATE OR REPLACE FUNCTION update_sales_returns_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_sales_returns_updated_at ON sales_returns
    `);

    await client.query(`
      CREATE TRIGGER trigger_sales_returns_updated_at
        BEFORE UPDATE ON sales_returns
        FOR EACH ROW
        EXECUTE FUNCTION update_sales_returns_updated_at()
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

const srpQuery = (text, params) => getSrpPool().query(text, params);
const getSrpClient = () => getSrpPool().connect();

module.exports = {
  pool,
  query,
  getClient,
  initialize,
  getSrpPool,
  srpQuery,
  getSrpClient,
};
