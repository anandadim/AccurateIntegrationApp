const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_BASE_URL = 'https://cday5l.pvt1.accurate.id/accurate/api';

// Load branches config
let branchesConfig = null;
const loadBranchesConfig = (forceReload = false) => {
  if (!branchesConfig || forceReload) {
    const configPath = path.join(__dirname, '../config/branches.json');
    if (fs.existsSync(configPath)) {
      branchesConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`✅ Loaded ${branchesConfig.branches?.length || 0} branches from config`);
    } else {
      console.warn('branches.json not found, using .env credentials');
      branchesConfig = { branches: [] };
    }
  }
  return branchesConfig;
};

// Clear cache (for reload)
const clearBranchesCache = () => {
  branchesConfig = null;
  console.log('🔄 Branches cache cleared');
};

// Get branch credentials and baseUrl
const getBranchConfig = (branchId) => {
  const config = loadBranchesConfig();
  const branch = config.branches.find(b => b.id === branchId && b.active);
  
  if (branch) {
    return {
      credentials: branch.credentials,
      baseUrl: branch.baseUrl || DEFAULT_BASE_URL
    };
  }
  
  // Fallback to .env
  return {
    credentials: {
      appKey: process.env.ACCURATE_APP_KEY,
      signatureSecret: process.env.ACCURATE_SIGNATURE_SECRET,
      clientId: process.env.ACCURATE_CLIENT_ID
    },
    baseUrl: DEFAULT_BASE_URL
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
  const branchConfig = getBranchConfig(branchId);
  const credentials = branchConfig.credentials;
  const baseUrl = branchConfig.baseUrl;
  
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
    baseURL: baseUrl,
    headers
  });
};

const accurateService = {
  // Get all branches from config
  getBranches(forceReload = false) {
    const config = loadBranchesConfig(forceReload);
    return config.branches.filter(b => b.active).map(b => ({
      id: b.id,
      name: b.name,
      dbId: b.dbId
    }));
  },

  // Reload branches config (clear cache)
  reloadBranches() {
    clearBranchesCache();
    return this.getBranches(true);
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

  // Fetch list only (without details) - for sync check
  async fetchListOnly(endpoint, dbId, filters = {}, branchId = null) {
    try {
      const client = createApiClient(dbId, branchId);
      const url = `/${endpoint}/list.do`;
      
      // Force pageSize to 1000 for efficiency
      const params = {
        ...filters,
        'sp.pageSize': 1000
      };
      
      console.log(`🌐 API Request: ${url}`);
      console.log(`📦 Params:`, JSON.stringify(params, null, 2));
      
      // Use paramsSerializer to handle array properly
      const response = await client.get(url, { 
        params,
        paramsSerializer: {
          serialize: (params) => {
            const parts = [];
            for (const [key, value] of Object.entries(params)) {
              if (Array.isArray(value)) {
                // For array, add same key multiple times
                value.forEach(v => parts.push(`${key}=${encodeURIComponent(v)}`));
              } else {
                parts.push(`${key}=${encodeURIComponent(value)}`);
              }
            }
            const queryString = parts.join('&');
            console.log(`🔗 Query String: ${queryString}`);
            return queryString;
          }
        }
      });
      
      console.log(`✅ Request sent successfully`);
      
      if (!response.data.s || !response.data.d) {
        throw new Error('Invalid response from list endpoint');
      }
      
      return {
        success: true,
        items: response.data.d,  // Array of invoice objects with id, number, optLock, etc
        pagination: response.data.sp
      };
    } catch (error) {
      console.error(`Error fetching ${endpoint} list:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch ${endpoint} list from Accurate API`);
    }
  },

  // Fetch list dengan filter
  async fetchDataWithFilter(endpoint, dbId, filters = {}, branchId = null) {
    try {
      const client = createApiClient(dbId, branchId);
      const url = `/${endpoint}.do`;
      
      // Force pageSize to 1000 if not already set
      const params = {
        ...filters
      };
      
      // Add pageSize if not present and this is a list endpoint
      if (!params['sp.pageSize'] && endpoint.includes('/list')) {
        params['sp.pageSize'] = 1000;
      }
      
      const response = await client.get(url, { params });
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint} with filters:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch ${endpoint} from Accurate API`);
    }
  },

  // NEW: Fetch and stream insert (insert per batch, not wait all)
  async fetchAndStreamInsert(endpoint, dbId, options = {}, branchId = null, branchName = '', onBatchCallback) {
    try {
      const { 
        maxItems = null, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'createdDate',
        batchSize = 50,
        batchDelay = 300
      } = options;
      
      const today = new Date().toISOString().split('T')[0];
      
      const formatDateForAccurate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };
      
      const fromDate = formatDateForAccurate(dateFrom || today);
      const toDate = formatDateForAccurate(dateTo || today);
      
      const filterKey = `filter.${dateFilterType}`;
      const filters = {
        [`${filterKey}.from`]: fromDate,
        [`${filterKey}.to`]: toDate
      };
      
      // 1. Get first page
      console.log(`📋 Fetching list from ${fromDate} to ${toDate}...`);
      const firstResponse = await this.fetchDataWithFilter(`${endpoint}/list`, dbId, filters, branchId);
      
      if (!firstResponse.s || !firstResponse.d) {
        throw new Error('Invalid response from list endpoint');
      }

      const totalRows = firstResponse.sp.rowCount;
      const pageSize = firstResponse.sp.pageSize || 1000;
      const totalPages = Math.ceil(totalRows / pageSize);
      
      console.log(`📊 Total: ${totalRows} invoices, ${totalPages} pages`);
      
      let allItems = [...firstResponse.d];
      
      // 2. Fetch remaining pages
      if (totalPages > 1) {
        console.log(`📄 Fetching ${totalPages - 1} more pages...`);
        
        for (let page = 2; page <= totalPages; page++) {
          const pageFilters = { ...filters, 'sp.page': page };
          const pageResponse = await this.fetchDataWithFilter(`${endpoint}/list`, dbId, pageFilters, branchId);
          
          if (pageResponse.s && pageResponse.d) {
            allItems = allItems.concat(pageResponse.d);
            process.stdout.write(`📄 Page ${page}/${totalPages} (${allItems.length} items)\r`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`\n✅ All pages fetched: ${allItems.length} items`);
      }
      
      // 3. Apply maxItems limit
      const itemsToFetch = maxItems ? allItems.slice(0, maxItems) : allItems;
      console.log(`🔍 Fetching details for ${itemsToFetch.length} invoices...`);

      // 4. Fetch details AND insert per batch (streaming)
      let totalSaved = 0;
      let totalErrors = 0;
      const totalBatches = Math.ceil(itemsToFetch.length / batchSize);
      
      for (let i = 0; i < itemsToFetch.length; i += batchSize) {
        const batch = itemsToFetch.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        
        console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} items)`);
        console.log(`   ├─ Fetching details...`);
        
        const batchPromises = batch.map(item => 
          this.fetchDetail(endpoint, item.id, dbId, branchId)
            .catch(err => {
              console.error(`   ├─ ❌ Failed ID ${item.id}: ${err.message}`);
              return { error: true, id: item.id, message: err.message };
            })
        );
        
        const batchDetails = await Promise.all(batchPromises);
        const successDetails = batchDetails.filter(d => !d.error);
        
        console.log(`   ├─ Fetched: ${successDetails.length}/${batch.length}`);
        console.log(`   └─ Inserting to database...`);
        
        // Insert this batch immediately
        if (onBatchCallback && successDetails.length > 0) {
          const saveResult = await onBatchCallback(successDetails);
          totalSaved += saveResult.savedCount;
          totalErrors += saveResult.errorCount;
          
          console.log(`   ✅ Batch ${batchNum} done: ${saveResult.savedCount} saved, ${saveResult.errorCount} errors`);
        }
        
        // Delay between batches
        if (i + batchSize < itemsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
      
      console.log(`\n🎉 All batches completed!`);

      return {
        success: true,
        totalFetched: itemsToFetch.length,
        savedCount: totalSaved,
        errorCount: totalErrors
      };

    } catch (error) {
      console.error(`❌ Error in fetchAndStreamInsert:`, error.message);
      throw error;
    }
  },

  // Fetch list dan semua detail-nya dengan pagination
  async fetchListWithDetails(endpoint, dbId, options = {}, branchId = null) {
    try {
      const { 
        maxItems = null, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'createdDate',
        batchSize = 50,  // Default 50 for faster sync
        batchDelay = 300 // Default 300ms delay
      } = options;
      
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
      
      // Support flexible date filter: transDate, createdDate, modifiedDate
      // Accurate API format: filter.{field}.val as array
      // Axios converts array to: filter.{field}.val=from&filter.{field}.val=to
      const filterKey = `filter.${dateFilterType}`;
      const filters = {
        [`${filterKey}.op`]: 'BETWEEN',  // Operator
        [`${filterKey}.val`]: [fromDate, toDate]  // Array for multiple values
        // 'filter.outstanding': false  // Commented: fetch all invoices
      };
      
      // 1. Get first page to check total rows and pages
      console.log(`Fetching ${endpoint} list from ${fromDate} to ${toDate} (filter by ${dateFilterType})...`);
      console.log('Filter params:', filters);
      const firstResponse = await this.fetchDataWithFilter(`${endpoint}/list`, dbId, filters, branchId);
      
      if (!firstResponse.s || !firstResponse.d) {
        throw new Error('Invalid response from list endpoint');
      }

      const totalRows = firstResponse.sp.rowCount;
      const pageSize = firstResponse.sp.pageSize || 1000; // Default Accurate page size
      const totalPages = Math.ceil(totalRows / pageSize);
      
      console.log(`Total rows: ${totalRows}, Page size: ${pageSize}, Total pages: ${totalPages}`);
      
      // Collect all items from all pages
      let allItems = [...firstResponse.d];
      
      // 2. Fetch remaining pages if needed
      if (totalPages > 1) {
        console.log(`Fetching remaining ${totalPages - 1} pages...`);
        
        for (let page = 2; page <= totalPages; page++) {
          console.log(`Fetching page ${page}/${totalPages}...`);
          
          const pageFilters = {
            ...filters,
            'sp.page': page
          };
          
          const pageResponse = await this.fetchDataWithFilter(`${endpoint}/list`, dbId, pageFilters, branchId);
          
          if (pageResponse.s && pageResponse.d) {
            allItems = allItems.concat(pageResponse.d);
            console.log(`Page ${page} fetched: ${pageResponse.d.length} items (Total so far: ${allItems.length})`);
          } else {
            console.warn(`Page ${page} returned invalid response, skipping...`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`Total items collected: ${allItems.length}`);
      
      // 3. Apply maxItems limit (if specified)
      const itemsToFetch = maxItems ? allItems.slice(0, maxItems) : allItems;
      const limitMsg = maxItems ? ` (limited by maxItems: ${maxItems})` : ' (no limit)';
      console.log(`Fetching details for ${itemsToFetch.length} items${limitMsg}...`);

      // 4. Fetch details in batches to avoid API overload
      const details = [];
      const totalBatches = Math.ceil(itemsToFetch.length / batchSize);
      
      console.log(`Batch settings: size=${batchSize}, delay=${batchDelay}ms`);
      
      for (let i = 0; i < itemsToFetch.length; i += batchSize) {
        const batch = itemsToFetch.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        
        console.log(`Fetching batch ${batchNum}/${totalBatches} (${batch.length} items)...`);
        
        const batchPromises = batch.map(item => 
          this.fetchDetail(endpoint, item.id, dbId, branchId)
            .catch(err => {
              console.error(`Failed to fetch detail for ID ${item.id}:`, err.message);
              return { error: true, id: item.id, message: err.message };
            })
        );
        
        const batchResults = await Promise.all(batchPromises);
        details.push(...batchResults);
        
        // Delay between batches (except for last batch)
        if (i + batchSize < itemsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }
      
      console.log(`Completed fetching ${details.length} details (${details.filter(d => !d.error).length} success, ${details.filter(d => d.error).length} errors)`);

      return {
        success: true,
        summary: {
          total: totalRows,
          totalPages: totalPages,
          fetched: itemsToFetch.length,
          pageSize: pageSize
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
