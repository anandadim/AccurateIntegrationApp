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
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(invoice_id, branch_id)
      )
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

    // Table untuk cache data (backward compatibility)
    await client.query(`
      CREATE TABLE IF NOT EXISTS accurate_data (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(255) NOT NULL,
        cabang_id VARCHAR(50),
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query('COMMIT');
    console.log('Database tables initialized successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Helper function to execute queries
const query = (text, params) => pool.query(text, params);

// Get a client from pool
const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  getClient,
  initialize
};
