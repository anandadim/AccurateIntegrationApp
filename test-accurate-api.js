require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');

const ACCURATE_BASE_URL = 'https://cday5l.pvt1.accurate.id/accurate/api';

// Generate signature
const generateSignature = (timestamp) => {
  const plainText = timestamp;
  const secret = process.env.ACCURATE_SIGNATURE_SECRET;
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(plainText);
  return hmac.digest('hex');
};

// Test API call
const testAPI = async () => {
  try {
    const timestamp = new Date().toISOString();
    const signature = generateSignature(timestamp);
    
    console.log('=== Testing Accurate API ===\n');
    console.log('URL:', `${ACCURATE_BASE_URL}/sales-invoice/list.do`);
    console.log('Timestamp:', timestamp);
    console.log('Signature:', signature);
    console.log('');
    
    const response = await axios.get(`${ACCURATE_BASE_URL}/sales-invoice/list.do`, {
      headers: {
        'Authorization': `Bearer ${process.env.ACCURATE_CLIENT_ID}`,
        'X-API-Timestamp': timestamp,
        'X-Api-Signature': signature,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
      console.log('Headers:', error.response.headers);
    } else {
      console.log('Error:', error.message);
    }
  }
};

testAPI();
