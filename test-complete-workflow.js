require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testCompleteWorkflow() {
  console.log('=== Testing Complete Workflow ===\n');
  
  try {
    // 1. Test health check
    console.log('1. Testing health check...');
    const healthResponse = await axios.get('http://localhost:3000/');
    console.log('✅ Server is running:', healthResponse.data.message);
    
    // 2. Test get branches
    console.log('\n2. Testing get branches...');
    const branchesResponse = await axios.get(`${BASE_URL}/branches`);
    console.log('✅ Branches:', branchesResponse.data.branches.length);
    branchesResponse.data.branches.forEach(b => {
      console.log(`   - ${b.name} (${b.id})`);
    });
    
    const branchId = branchesResponse.data.branches[0].id;
    console.log(`\nUsing branch: ${branchId}`);
    
    // 3. Sync sales invoices
    console.log('\n3. Syncing sales invoices...');
    const today = new Date().toISOString().split('T')[0];
    const syncResponse = await axios.post(
      `${BASE_URL}/sales-invoices/sync`,
      null,
      {
        params: {
          branchId: branchId,
          dateFrom: today,
          dateTo: today,
          maxItems: 10
        }
      }
    );
    console.log('✅ Sync result:', syncResponse.data.message);
    console.log('   Summary:', JSON.stringify(syncResponse.data.summary, null, 2));
    
    // 4. Get invoices
    console.log('\n4. Getting invoices from database...');
    const invoicesResponse = await axios.get(`${BASE_URL}/sales-invoices`, {
      params: {
        branchId: branchId,
        limit: 5
      }
    });
    console.log(`✅ Found ${invoicesResponse.data.count} invoices`);
    
    if (invoicesResponse.data.data.length > 0) {
      const firstInvoice = invoicesResponse.data.data[0];
      console.log('\n   First invoice:');
      console.log(`   - Number: ${firstInvoice.invoice_number}`);
      console.log(`   - Date: ${firstInvoice.trans_date}`);
      console.log(`   - Customer: ${firstInvoice.customer_name}`);
      console.log(`   - Total: Rp ${parseFloat(firstInvoice.total).toLocaleString('id-ID')}`);
      
      // 5. Get invoice detail
      console.log('\n5. Getting invoice detail...');
      const detailResponse = await axios.get(`${BASE_URL}/sales-invoices/${firstInvoice.id}`);
      console.log(`✅ Invoice detail with ${detailResponse.data.data.items.length} items`);
      
      if (detailResponse.data.data.items.length > 0) {
        console.log('\n   First item:');
        const item = detailResponse.data.data.items[0];
        console.log(`   - Item: ${item.item_no}`);
        console.log(`   - Name: ${item.item_name}`);
        console.log(`   - Qty: ${item.quantity} ${item.unit_name}`);
        console.log(`   - Price: Rp ${parseFloat(item.unit_price).toLocaleString('id-ID')}`);
        console.log(`   - Amount: Rp ${parseFloat(item.amount).toLocaleString('id-ID')}`);
      }
    }
    
    // 6. Get summary
    console.log('\n6. Getting summary statistics...');
    const summaryResponse = await axios.get(`${BASE_URL}/sales-invoices/summary/stats`, {
      params: {
        branchId: branchId
      }
    });
    console.log('✅ Summary:');
    summaryResponse.data.data.forEach(s => {
      console.log(`\n   ${s.branch_name}:`);
      console.log(`   - Invoices: ${s.invoice_count}`);
      console.log(`   - Total Sales: Rp ${parseFloat(s.total_sales).toLocaleString('id-ID')}`);
      console.log(`   - Avg Invoice: Rp ${parseFloat(s.avg_invoice).toLocaleString('id-ID')}`);
      console.log(`   - Date Range: ${s.first_date} to ${s.last_date}`);
    });
    
    console.log('\n\n✅ All tests passed! Workflow is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    console.error('\nTroubleshooting:');
    console.error('1. Make sure backend is running: npm run dev');
    console.error('2. Make sure PostgreSQL is running');
    console.error('3. Check .env configuration');
  }
}

testCompleteWorkflow();
