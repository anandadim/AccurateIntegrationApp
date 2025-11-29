require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const ACCURATE_BASE_URL = 'https://cday5l.pvt1.accurate.id/accurate/api';

const generateSignature = (timestamp) => {
  const hmac = crypto.createHmac('sha256', process.env.ACCURATE_SIGNATURE_SECRET);
  hmac.update(timestamp);
  return hmac.digest('hex');
};

const testSalesInvoiceDetail = async () => {
  try {
    const timestamp = new Date().toISOString();
    const signature = generateSignature(timestamp);
    
    // Ganti dengan DB ID Anda
    const dbId = '1869410'; // Sesuaikan dengan DB ID Anda
    
    console.log('=== Testing Sales Invoice Detail ===\n');
    
    // 1. Get list first
    console.log('1. Fetching sales invoice list...');
    const listResponse = await axios.get(`${ACCURATE_BASE_URL}/sales-invoice/list.do`, {
      headers: {
        'Authorization': `Bearer ${process.env.ACCURATE_CLIENT_ID}`,
        'X-API-Timestamp': timestamp,
        'X-Api-Signature': signature,
        'X-Session-ID': dbId,
        'Content-Type': 'application/json'
      }
    });
    
    if (listResponse.data.s && listResponse.data.d.length > 0) {
      const firstInvoiceId = listResponse.data.d[0].id;
      console.log(`Found invoice ID: ${firstInvoiceId}\n`);
      
      // 2. Get detail
      console.log('2. Fetching invoice detail...');
      const timestamp2 = new Date().toISOString();
      const signature2 = generateSignature(timestamp2);
      
      const detailResponse = await axios.get(`${ACCURATE_BASE_URL}/sales-invoice/detail.do`, {
        headers: {
          'Authorization': `Bearer ${process.env.ACCURATE_CLIENT_ID}`,
          'X-API-Timestamp': timestamp2,
          'X-Api-Signature': signature2,
          'X-Session-ID': dbId,
          'Content-Type': 'application/json'
        },
        params: {
          id: firstInvoiceId
        }
      });
      
      console.log('✅ Detail Response:');
      console.log(JSON.stringify(detailResponse.data, null, 2));
      
      // Show important fields
      if (detailResponse.data.d) {
        const d = detailResponse.data.d;
        console.log('\n=== Important Fields ===');
        console.log('Invoice Number:', d.number);
        console.log('Date:', d.transDate);
        console.log('Customer:', d.customer);
        console.log('Salesman:', d.salesman);
        console.log('Warehouse:', d.warehouse);
        console.log('Total:', d.total);
        console.log('\nDetail Items:', d.detailItem?.length || 0, 'items');
        if (d.detailItem && d.detailItem.length > 0) {
          console.log('First item:', JSON.stringify(d.detailItem[0], null, 2));
        }
      }
    }
    
  } catch (error) {
    console.log('❌ Error!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
};

testSalesInvoiceDetail();
