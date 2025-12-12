const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'accurate_db',
  password: 'postgres',
  connectionString: process.env.DATABASE_URL,
});

const runMigration = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running smart migration...\n');
    
    // Drop old tables if they exist (to start fresh)
    console.log('📋 Dropping old tables...');
    await client.query('DROP TABLE IF EXISTS purchase_invoice_items CASCADE');
    await client.query('DROP TABLE IF EXISTS purchase_invoices CASCADE');
    console.log('✅ Old tables dropped\n');
    
    // Create new tables with correct schema
    console.log('📋 Creating new tables...');
    
    // Purchase Invoices Header Table
    await client.query(`
      CREATE TABLE purchase_invoices (
        id SERIAL PRIMARY KEY,
        invoice_id BIGINT UNIQUE NOT NULL,
        invoice_number VARCHAR(50) NOT NULL,
        branch_id VARCHAR(50) NOT NULL,
        branch_name VARCHAR(255),
        
        -- Dates
        trans_date DATE,
        invoice_date DATE,
        due_date DATE,
        
        -- Vendor/Supplier
        vendor_id VARCHAR(50),
        vendor_name VARCHAR(255),
        
        -- Bill Info
        bill_number VARCHAR(50),
        
        -- Amounts
        subtotal DECIMAL(15,2) DEFAULT 0,
        tax_amount DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) DEFAULT 0,
        prime_owing DECIMAL(15,2) DEFAULT 0,
        
        -- Status
        status_name VARCHAR(50),
        
        -- AP Account
        ap_account_id VARCHAR(50),
        ap_account_no VARCHAR(50),
        
        -- User Info
        created_by VARCHAR(255),
        
        -- Metadata
        opt_lock INTEGER DEFAULT 0,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ purchase_invoices table created');
    
    // Purchase Invoice Items Table
    await client.query(`
      CREATE TABLE purchase_invoice_items (
        id SERIAL PRIMARY KEY,
        invoice_id BIGINT NOT NULL,
        
        -- Item info
        item_id VARCHAR(50),
        item_no VARCHAR(50),
        item_name VARCHAR(255),
        
        -- Quantity and pricing
        quantity DECIMAL(15,4) DEFAULT 0,
        unit_name VARCHAR(50),
        unit_price DECIMAL(15,2) DEFAULT 0,
        discount DECIMAL(15,2) DEFAULT 0,
        amount DECIMAL(15,2) DEFAULT 0,
        
        -- Warehouse
        warehouse_id VARCHAR(50),
        warehouse_name VARCHAR(255),
        
        -- GL Accounts
        gl_inventory_id VARCHAR(50),
        gl_cogs_id VARCHAR(50),
        
        -- Category
        item_category VARCHAR(50),
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(invoice_id) ON DELETE CASCADE
      )
    `);
    console.log('✅ purchase_invoice_items table created\n');
    
    // Create indexes
    console.log('📋 Creating indexes...');
    await client.query(`
      CREATE INDEX idx_purchase_invoices_branch_date 
      ON purchase_invoices(branch_id, trans_date)
    `);
    await client.query(`
      CREATE INDEX idx_purchase_invoices_vendor 
      ON purchase_invoices(vendor_id)
    `);
    await client.query(`
      CREATE INDEX idx_purchase_invoice_items_invoice 
      ON purchase_invoice_items(invoice_id)
    `);
    console.log('✅ Indexes created\n');
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Tables created:');
    console.log('   - purchase_invoices');
    console.log('   - purchase_invoice_items');
    console.log('\n📊 Indexes created:');
    console.log('   - idx_purchase_invoices_branch_date');
    console.log('   - idx_purchase_invoices_vendor');
    console.log('   - idx_purchase_invoice_items_invoice');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigration();
