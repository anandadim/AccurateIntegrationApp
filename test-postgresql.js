require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function testConnection() {
  console.log('=== Testing PostgreSQL Connection ===\n');
  
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Get version
    const versionResult = await client.query('SELECT version()');
    console.log('PostgreSQL Version:', versionResult.rows[0].version.split(',')[0]);
    
    // List tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check sales_invoices
    const invoiceCount = await client.query('SELECT COUNT(*) FROM sales_invoices');
    console.log(`\n📊 Sales Invoices: ${invoiceCount.rows[0].count} records`);
    
    // Check sales_invoice_items
    const itemCount = await client.query('SELECT COUNT(*) FROM sales_invoice_items');
    console.log(`📦 Invoice Items: ${itemCount.rows[0].count} records`);
    
    // Sample data
    const sampleResult = await client.query(`
      SELECT invoice_number, branch_name, trans_date, customer_name, total
      FROM sales_invoices
      ORDER BY trans_date DESC
      LIMIT 5
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('\n📄 Sample Invoices:');
      sampleResult.rows.forEach(row => {
        console.log(`  ${row.invoice_number} | ${row.branch_name} | ${row.trans_date} | Rp ${row.total}`);
      });
    } else {
      console.log('\n⚠️  No invoices found. Run sync first!');
    }
    
    client.release();
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check PostgreSQL is running');
    console.error('2. Verify DATABASE_URL in .env');
    console.error('3. Check database exists: CREATE DATABASE accurate_db;');
  } finally {
    await pool.end();
  }
}

testConnection();
