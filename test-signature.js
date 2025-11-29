require('dotenv').config();
const crypto = require('crypto');

// Generate signature
const timestamp = new Date().toISOString();
const secret = process.env.ACCURATE_SIGNATURE_SECRET;

console.log('=== Testing Signature Generation ===\n');
console.log('Timestamp:', timestamp);
console.log('Secret:', secret);
console.log('');

// Generate HMAC SHA256
const hmac = crypto.createHmac('sha256', secret);
hmac.update(timestamp);
const signature = hmac.digest('hex');

console.log('Generated Signature (hex):', signature);
console.log('');

// Also try base64 encoding
const hmac2 = crypto.createHmac('sha256', secret);
hmac2.update(timestamp);
const signatureBase64 = hmac2.digest('base64');

console.log('Generated Signature (base64):', signatureBase64);
console.log('');

// Test headers that will be sent
console.log('=== Headers yang akan dikirim ===');
console.log('Authorization:', `Bearer ${process.env.ACCURATE_CLIENT_ID}`);
console.log('X-API-Timestamp:', timestamp);
console.log('X-Api-Signature:', signature);
