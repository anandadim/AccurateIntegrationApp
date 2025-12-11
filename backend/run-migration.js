const fs = require('fs');
const path = require('path');
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
    console.log('🔄 Running migration...\n');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_purchase_invoices_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Tables created/updated:');
    console.log('   - purchase_invoices');
    console.log('   - purchase_invoice_items');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigration();
