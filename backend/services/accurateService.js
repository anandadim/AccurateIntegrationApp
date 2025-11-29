const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ACCURATE_BASE_URL = 'https://cday5l.pvt1.accurate.id/accurate/api';

// Load branches config
let branchesConfig = null;
const loadBranchesConfig = () => {
  if (!branchesConfig) {
    const configPath = path.join(__dirname, '../config/branches.json');
    if (fs.existsSync(configPath)) {
      branchesConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      console.warn('branches.json not found, using .env credentials');
      branchesConfig = { branches: [] };
    }
  }
  return branchesConfig;
};

// Get branch credentials
const getBranchCredentials = (branchId) => {
  const config = loadBranchesConfig();
  const branch = config.branches.find(b => b.id === branchId && b.active);
  
  if (branch) {
    return branch.credentials;
  }
  
  // Fallback to .env
  return {
    appKey: process.env.ACCURATE_APP_KEY,
    signatureSecret: process.env.ACCURATE_SIGNATURE_SECRET,
    clientId: process.env.ACCURATE_CLIENT_ID
  };
};

// Helper untuk generate signature
const generateSignature = (timestamp, secret) => {
  const plainText = timestamp;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(plainText);
  return hmac.digest('hex');
};

// Helper untuk create axios instance dengan auth
const createApiClient = (dbId = null, branchId = null) => {
  const credentials = getBranchCredentials(branchId);
  const timestamp = new Date().toISOString();
  const signature = generateSignature(timestamp, credentials.signatureSecret);
  
  const headers = {
    'Authorization': `Bearer ${credentials.clientId}`,
    'X-API-Timestamp': timestamp,
    'X-Api-Signature': signature,
    'Content-Type': 'application/json'
  };

  if (dbId) {
    headers['X-Session-ID'] = dbId;
  }

  return axios.create({
    baseURL: ACCURATE_BASE_URL,
    headers
  });
};

const accurateService = {
  // Get all branches from config
  getBranches() {
    const config = loadBranchesConfig();
    return config.branches.filter(b => b.active).map(b => ({
      id: b.id,
      name: b.name,
      dbId: b.dbId
    }));
  },

  // Get list databases (cabang)
  async getDatabases(branchId = null) {
    try {
      const client = createApiClient(null, branchId);
      const response = await client.get('/db/list.do');
      return response.data;
    } catch (error) {
      console.error('Error fetching databases:', error.response?.data || error.message);
      throw new Error('Failed to fetch databases from Accurate API');
    }
  },

  // Fetch data dari endpoint tertentu
  async fetchData(endpoint, dbId, branchId = null) {
    try {
      const client = createApiClient(dbId, branchId);
      
      // Construct URL - endpoint bisa seperti 'customer/list', 'item/list', dll
      const url = `/${endpoint}.do`;
      
      const response = await client.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch ${endpoint} from Accurate API`);
    }
  },

  // Fetch detail by ID
  async fetchDetail(endpoint, id, dbId, branchId = null) {
    try {
      const client = createApiClient(dbId, branchId);
      const url = `/${endpoint}/detail.do`;
      
      const response = await client.get(url, {
        params: { id }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint} detail for ID ${id}:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch ${endpoint} detail from Accurate API`);
    }
  },

  // Fetch list dengan filter
  async fetchDataWithFilter(endpoint, dbId, filters = {}, branchId = null) {
    try {
      const client = createApiClient(dbId, branchId);
      const url = `/${endpoint}.do`;
      
      const response = await client.get(url, { params: filters });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint} with filters:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch ${endpoint} from Accurate API`);
    }
  },

  // Fetch list dan semua detail-nya
  async fetchListWithDetails(endpoint, dbId, options = {}, branchId = null) {
    try {
      const { maxItems = 20, dateFrom, dateTo } = options;
      
      // Setup date filter (default: today)
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Convert date format from YYYY-MM-DD to DD/MM/YYYY for Accurate API
      const formatDateForAccurate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };
      
      const fromDate = formatDateForAccurate(dateFrom || today);
      const toDate = formatDateForAccurate(dateTo || today);
      
      const filters = {
        'filter.transDate.from': fromDate,
        'filter.transDate.to': toDate
      };
      
      // 1. Get list with date filter
      console.log(`Fetching ${endpoint} list from ${fromDate} to ${toDate}...`);
      console.log('Filter params:', filters);
      const listResponse = await this.fetchDataWithFilter(`${endpoint}/list`, dbId, filters, branchId);
      
      if (!listResponse.s || !listResponse.d) {
        throw new Error('Invalid response from list endpoint');
      }

      const items = listResponse.d.slice(0, maxItems); // Limit items
      console.log(`Found ${items.length} items, fetching details...`);

      // 2. Fetch details untuk setiap item
      const detailPromises = items.map(item => 
        this.fetchDetail(endpoint, item.id, dbId, branchId)
          .catch(err => {
            console.error(`Failed to fetch detail for ID ${item.id}:`, err.message);
            return { error: true, id: item.id, message: err.message };
          })
      );

      const details = await Promise.all(detailPromises);

      return {
        success: true,
        summary: {
          total: listResponse.sp.rowCount,
          fetched: items.length,
          page: listResponse.sp.page,
          pageSize: listResponse.sp.pageSize
        },
        items: details.filter(d => !d.error), // Filter out errors
        errors: details.filter(d => d.error)
      };

    } catch (error) {
      console.error(`Error in fetchListWithDetails:`, error.message);
      throw error;
    }
  }
};

module.exports = accurateService;
