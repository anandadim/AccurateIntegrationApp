import axios from 'axios'
//  const API_BASE = import.meta.env.VITE_API_BASE ?? import.meta.env.VITE_API_URL ?? '/api';

const API_BASE = '/api'

const apiService = {
  // Helper method for GET requests
  async get(url) {
    const response = await axios.get(`${API_BASE}${url}`);
    return response.data;
  },
  
  // Helper method for POST requests
  async post(url, data) {
    const response = await axios.post(`${API_BASE}${url}`, data);
    return response.data;
  },

  // Helper method for PUT requests
  async put(url, data) {
    const response = await axios.put(`${API_BASE}${url}`, data);
    return response.data;
  },

  // === Stock on Hand ===
  async fetchStockOnHand(options = {}) {
    const { branchId, itemFilter, stockFilter, warehouseId } = options
    const params = { branchId }
    
    if (itemFilter) params.itemFilter = itemFilter
    if (stockFilter) params.stockFilter = stockFilter
    if (warehouseId) params.warehouseId = warehouseId
    
    const response = await axios.get(`${API_BASE}/stock-on-hand`, { params })
    return response.data
  },

  async getStockOnHandFromDB(options = {}) {
    const { branchId, warehouseId, itemNo, itemName, hasStock, limit, offset } = options
    const params = { branchId }
    
    if (warehouseId) params.warehouseId = warehouseId
    if (itemNo) params.itemNo = itemNo
    if (itemName) params.itemName = itemName
    if (hasStock) params.hasStock = hasStock
    if (limit) params.limit = limit
    if (offset) params.offset = offset
    
    const response = await axios.get(`${API_BASE}/stock-on-hand/db`, { params })
    return response.data
  },

  async checkStockOnHandSync(branchId) {
    const response = await axios.get(`${API_BASE}/stock-on-hand/check-sync`, { params: { branchId } })
    return response.data
  },

  async saveStockOnHand(branchId, data) {
    const response = await axios.post(`${API_BASE}/stock-on-hand/save`, { branchId, data })
    return response.data
  },

  async getStockOnHandWarehouses(branchId) {
    const response = await axios.get(`${API_BASE}/stock-on-hand/warehouses`, { params: { branchId } })
    return response.data
  },

  // === SNJ Merch (SRP) Item Enquiry ===
  async getSrpBranches() {
    const response = await axios.get(`${API_BASE}/srp/branches`)
    return response.data
  },

  async reloadSrpBranches() {
    const response = await axios.post(`${API_BASE}/srp/branches/reload`)
    return response.data
  },

  async getSrpLogs(options = {}) {
    const { limit = 20, status } = options
    const params = {}

    if (limit) params.limit = limit
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status
    }

    const response = await axios.get(`${API_BASE}/srp/logs`, { params })
    return response.data
  },

  async getSrpSchedulerStatus() {
    const response = await axios.get(`${API_BASE}/srp/scheduler/status`)
    return response.data
  },

  async pauseSrpScheduler() {
    const response = await axios.post(`${API_BASE}/srp/scheduler/pause`)
    return response.data
  },

  async resumeSrpScheduler() {
    const response = await axios.post(`${API_BASE}/srp/scheduler/resume`)
    return response.data
  },

  async runSrpSchedulerNow() {
    const response = await axios.post(`${API_BASE}/srp/scheduler/run-now`)
    return response.data
  },

  // === Accurate Scheduler ===
  async getAccurateLogs(options = {}) {
    const { limit = 20, status, branchId, dataType } = options
    const params = {}

    if (limit) params.limit = limit
    if (status) {
      params.status = Array.isArray(status) ? status.join(',') : status
    }
    if (branchId) params.branchId = branchId
    if (dataType) params.dataType = dataType

    const response = await axios.get(`${API_BASE}/accurate/scheduler/logs`, { params })
    return response.data
  },

  async syncSrpInventory(options = {}) {
    const {
      branchId,
      locationCode,
      articleCodes,
      perPage,
      maxPages,
      pageDelay,
      truncateBeforeInsert,
      endpoint,
    } = options

    const payload = {}

    if (branchId) {
      payload.branchId = branchId
    }

    if (locationCode) {
      payload.locationCode = locationCode
    }

    if (endpoint) {
      payload.endpoint = endpoint
    }

    if (articleCodes && articleCodes.length) {
      payload.articleCodes = Array.isArray(articleCodes) ? articleCodes : String(articleCodes)
    }
    if (perPage) payload.perPage = perPage
    if (maxPages !== undefined && maxPages !== null) payload.maxPages = maxPages
    if (pageDelay) payload.pageDelay = pageDelay
    if (typeof truncateBeforeInsert === 'boolean') payload.truncateBeforeInsert = truncateBeforeInsert

    const response = await axios.post(`${API_BASE}/srp/item-enquiry/sync`, payload)
    return response.data
  },

  async fetchSrpSalesDetail({ branchId, storeCode, dateFrom, dateTo } = {}) {
    const params = {}

    if (branchId) params.branchId = branchId
    if (storeCode) params.storeCode = storeCode
    if (dateFrom) params.dateFrom = dateFrom
    if (dateTo) params.dateTo = dateTo

    const response = await axios.get(`${API_BASE}/srp/sales-detail`, { params })
    return response.data
  },

  async syncSrpSalesDetail(options = {}) {
    const {
      branchId,
      storeCode,
      dateFrom,
      dateTo,
      chunkSizeDays,
      delayMs,
      truncateBeforeInsert,
    } = options

    const payload = {}

    if (branchId) payload.branchId = branchId
    if (storeCode) payload.storeCode = storeCode
    if (dateFrom) payload.dateFrom = dateFrom
    if (dateTo) payload.dateTo = dateTo
    if (chunkSizeDays) payload.chunkSizeDays = chunkSizeDays
    if (delayMs) payload.delayMs = delayMs
    if (typeof truncateBeforeInsert === 'boolean') payload.truncateBeforeInsert = truncateBeforeInsert

    const response = await axios.post(`${API_BASE}/srp/sales-detail/sync`, payload)
    return response.data
  },
  async getBranches(reload = false) {
    try {
      const params = reload ? { reload: 'true' } : {}
      const response = await axios.get(`${API_BASE}/branches`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching branches:', error)
      throw error
    }
  },

  async reloadBranches() {
    try {
      const response = await axios.post(`${API_BASE}/branches/reload`)
      return response.data
    } catch (error) {
      console.error('Error reloading branches:', error)
      throw error
    }
  },

  async getDatabases(branchId = null) {
    try {
      const params = branchId ? { branchId } : {}
      const response = await axios.get(`${API_BASE}/databases`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching databases:', error)
      throw error
    }
  },

  async getData(endpoint, dbId, branchId = null) {
    try {
      const params = { dbId }
      if (branchId) params.branchId = branchId
      
      const response = await axios.get(`${API_BASE}/data/${endpoint}`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching data:', error)
      throw error
    }
  },

  async getCachedData(endpoint, dbId) {
    try {
      const response = await axios.get(`${API_BASE}/cache/${endpoint}`, {
        params: { dbId }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching cached data:', error)
      throw error
    }
  },

  async getListWithDetails(endpoint, dbId, options = {}) {
    try {
      const { maxItems = 20, dateFrom, dateTo, branchId } = options
      const params = { dbId, maxItems }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (branchId) params.branchId = branchId
      
      const response = await axios.get(`${API_BASE}/details/${endpoint}`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching list with details:', error)
      throw error
    }
  },

  // NEW: Count invoices (dry-run)
  async countInvoices(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, dateFilterType = 'createdDate' } = options
      const params = { branchId, dateFilterType }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/sales-invoices/count`, { params })
      return response.data
    } catch (error) {
      console.error('Error counting invoices:', error)
      throw error
    }
  },

  // === SALES RECEIPT METHODS ===

  // === SALES RETURN METHODS ===
  // Check sales return sync status
  async checkReturnSyncStatus(options = {}) {
    const { branchId, dateFrom, dateTo, dateFilterType = 'transDate' } = options
    const params = { branchId, dateFilterType }
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    const res = await axios.get(`${API_BASE}/sales-returns/check-sync`, { params })
    return res.data
  },
  // Sync sales returns
  async syncReturns(options = {}) {
    const { branchId, dateFrom, dateTo, dateFilterType='transDate', batchSize=50, batchDelay=300, maxItems } = options
    const params = { branchId, dateFilterType, batchSize, batchDelay }
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    if(maxItems) params.maxItems = maxItems
    const res = await axios.post(`${API_BASE}/sales-returns/sync`, params)
    return res.data
  },
  // Get returns list
  async getReturns(options = {}) {
    const { branchId, dateFrom, dateTo, customerId, limit=100, offset=0 } = options
    const params = { limit, offset }
    if(branchId) params.branchId = branchId
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    if(customerId) params.customerId = customerId
    const res = await axios.get(`${API_BASE}/sales-returns`, { params })
    return res.data
  },
  // Get return summary
  async getReturnSummary(options = {}) {
    const { branchId, dateFrom, dateTo } = options
    const params = {}
    if(branchId) params.branchId = branchId
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    const res = await axios.get(`${API_BASE}/sales-returns/summary/stats`, { params })
    return res.data
  },
  // Check sales receipt sync status
  async checkReceiptSyncStatus(options = {}) {
    const { branchId, dateFrom, dateTo, dateFilterType = 'createdDate' } = options
    const params = { branchId, dateFilterType }
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    const res = await axios.get(`${API_BASE}/sales-receipts/check-sync`, { params })
    return res.data
  },
  // Sync sales receipts (non-stream mode)
  async syncReceipts(options = {}) {
    const { branchId, dateFrom, dateTo, dateFilterType='createdDate', batchSize=50, batchDelay=300, maxItems } = options
    const params = { branchId, dateFilterType, batchSize, batchDelay }
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    if(maxItems) params.maxItems = maxItems
    const res = await axios.post(`${API_BASE}/sales-receipts/sync`, params)
    return res.data
  },
  // Get receipts list
  async getReceipts(options = {}) {
    const { branchId, dateFrom, dateTo, customerId, limit=100, offset=0 } = options
    const params = { limit, offset }
    if(branchId) params.branchId = branchId
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    if(customerId) params.customerId = customerId
    const res = await axios.get(`${API_BASE}/sales-receipts`, { params })
    return res.data
  },
  // Get receipt summary
  async getReceiptSummary(options = {}) {
    const { branchId, dateFrom, dateTo } = options
    const params = {}
    if(branchId) params.branchId = branchId
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    const res = await axios.get(`${API_BASE}/sales-receipts/summary/stats`, { params })
    return res.data
  },

// NEW: Check sync status (compare API vs DB)
  async checkSyncStatus(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, dateFilterType = 'createdDate' } = options
      const params = { branchId, dateFilterType }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/sales-invoices/check-sync`, { params })
      return response.data
    } catch (error) {
      console.error('Error checking sync status:', error)
      throw error
    }
  },

  // NEW: Smart sync (only new + updated)
  async syncSmart(options = {}) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'createdDate',
        batchSize = 50,
        batchDelay = 300,
        mode = 'missing'  // 'missing' or 'all'
      } = options
      
      const params = { 
        branchId, 
        dateFilterType,
        batchSize,
        batchDelay,
        mode
      }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.post(`${API_BASE}/sales-invoices/sync-smart`, {}, { 
        params,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return response.data
    } catch (error) {
      console.error('Error in smart sync:', error)
      throw error
    }
  },

  // NEW: Sync invoices
  async syncInvoices(options = {}) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'createdDate',
        batchSize = 50,
        batchDelay = 300,
        streamInsert = true,
        maxItems
      } = options
      
      const params = { 
        branchId, 
        dateFilterType,
        batchSize,
        batchDelay,
        streamInsert: streamInsert ? 'true' : 'false'
      }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (maxItems) params.maxItems = maxItems
      
      const response = await axios.post(`${API_BASE}/sales-invoices/sync`, null, { params })
      return response.data
    } catch (error) {
      console.error('Error syncing invoices:', error)
      throw error
    }
  },

  // Get synced invoices from database
  async getInvoices(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, customerId, limit = 100, offset = 0 } = options
      const params = { limit, offset }
      
      if (branchId) params.branchId = branchId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (customerId) params.customerId = customerId
      
      const response = await axios.get(`${API_BASE}/sales-invoices`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching invoices:', error)
      throw error
    }
  },

  // Get invoice summary
  async getInvoiceSummary(options = {}) {
    try {
      const { branchId, dateFrom, dateTo } = options
      const params = {}
      
      if (branchId) params.branchId = branchId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/sales-invoices/summary/stats`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching invoice summary:', error)
      throw error
    }
  },

  // Goods API Methods
async checkGoodsSyncStatus(branchId) {
  try {
    const response = await axios.get(`${API_BASE}/goods/check-sync?branchId=${branchId}`);
    console.log('API Response:', response); // Debug log
    return response.data; // Return only the data, not the full response
  } catch (error) {
    console.error('Error in checkGoodsSyncStatus:', error);
    throw error;
  }
},

async countGoods() {
  return this.get('/goods/count');
},

async syncGoods(branchId, batchSize = 50, delayMs = 100) {
  return this.post('/goods/sync', {
    branchId,
    batchSize,
    delayMs,
    streamInsert: false
  });
},

async getGoods(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category_id) params.append('category_id', filters.category_id);
  if (filters.item_type) params.append('item_type', filters.item_type);
  if (filters.suspended !== undefined) params.append('suspended', filters.suspended);
  if (filters.search) params.append('search', filters.search);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset !== undefined) params.append('offset', filters.offset);
  
  const response = await axios.get(`${API_BASE}/goods?${params.toString()}`);
  return response.data;
},

async getGoodsById(id) {
  const response = await axios.get(`${API_BASE}/goods/${id}`);
  return response.data;
},

async getGoodsSummary(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category_id) params.append('category_id', filters.category_id);
  if (filters.suspended !== undefined) params.append('suspended', filters.suspended);
  
  return this.get(`/goods/summary/stats?${params.toString()}`);
},

  // === SALES ORDER METHODS ===

  // Check sales order sync status
  async checkOrderSyncStatus(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, dateFilterType = 'transDate' } = options
      const params = { branchId, dateFilterType }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/sales-orders/check-sync`, { params })
      return response.data
    } catch (error) {
      console.error('Error checking order sync status:', error)
      throw error
    }
  },

  // Smart sync sales orders
  async syncOrdersSmart(options = {}) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'transDate',
        batchSize = 20,
        batchDelay = 500,
        mode = 'missing'
      } = options
      
      const params = { 
        branchId, 
        dateFilterType,
        batchSize,
        batchDelay,
        mode
      }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.post(`${API_BASE}/sales-orders/sync-smart`, {}, { 
        params,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return response.data
    } catch (error) {
      console.error('Error in order smart sync:', error)
      throw error
    }
  },

  // Get synced orders from database
  async getOrders(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, customerId, orderStatus, limit = 100, offset = 0 } = options
      const params = { limit, offset }
      
      if (branchId) params.branchId = branchId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (customerId) params.customerId = customerId
      if (orderStatus) params.orderStatus = orderStatus
      
      const response = await axios.get(`${API_BASE}/sales-orders`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching orders:', error)
      throw error
    }
  },

  // Get order summary
  async getOrderSummary(options = {}) {
    try {
      const { branchId, dateFrom, dateTo } = options
      const params = {}
      
      if (branchId) params.branchId = branchId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/sales-orders/summary/stats`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching order summary:', error)
      throw error
    }
  },
// === ITEM SYNC METHODS ===

  // Check item sync status
  async checkItemSyncStatus(options = {}) {
    try {
      const { branchId, dateFrom, dateTo } = options
      const params = { branchId }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/items/check-sync`, { params })
      return response.data
    } catch (error) {
      console.error('Error checking item sync status:', error)
      throw error
    }
  },

  // Smart sync items
  async syncItemsSmart(options = {}) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo,
        batchSize = 50,
        batchDelay = 300,
        mode = 'missing'
      } = options
      
      const params = { 
        branchId,
        batchSize,
        batchDelay,
        mode
      }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.post(`${API_BASE}/items/sync-smart`, {}, { 
        params,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return response.data
    } catch (error) {
      console.error('Error in item smart sync:', error)
      throw error
    }
  },

  // === CUSTOMER METHODS ===
  async checkCustomerSyncStatus({ branchId }) {
    const response = await axios.get(`${API_BASE}/customers/check-sync`, { params: { branchId } })
    return response.data
  },
  async syncCustomersSmart({ branchId, mode = 'missing', batchSize = 50, batchDelay = 300 }) {
    const params = { branchId, mode, batchSize, batchDelay }
    const response = await axios.post(`${API_BASE}/customers/sync-smart`, {}, { params })
    return response.data
  },
  async getCustomers({ branchId, limit = 100, offset = 0 }) {
    const params = { branchId, limit, offset }
    const response = await axios.get(`${API_BASE}/customers`, { params })
    return response.data
  },

// === ITEM METHODS ===

  // Get items list from Accurate API
  async getItems(options = {}) {
    try {
      const { db, branch, page = 1, q, limit = 100 } = options
      const params = { db, page, limit }
      
      if (branch) params.branch = branch
      if (q) params.q = q
      
      const response = await axios.get(`${API_BASE}/item`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching items:', error)
      throw error
    }
  },

  // Get item details by ID
  async getItemDetails(itemId, options = {}) {
    try {
      const { warehouse } = options
      const params = {}
      
      if (warehouse) params.warehouse = warehouse
      
      const response = await axios.get(`${API_BASE}/items/${itemId}`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching item details:', error)
      throw error
    }
  },

  // Check sync status for item mutations
  async checkItemMutationsSync(options = {}) {
    try {
      const { branchId, warehouseId, dateFrom, dateTo, dateFilterType = 'createDate' } = options
      const params = { branchId, dateFilterType }
      
      if (warehouseId) {
        params.warehouseId = warehouseId
      }
      if (dateFrom) {
        params.dateFrom = dateFrom
      }
      if (dateTo) {
        params.dateTo = dateTo
      }
      
      const response = await axios.get(`${API_BASE}/item-mutations/check-sync`, { params })
      return response.data
    } catch (error) {
      console.error('Error checking item mutations sync:', error)
      throw error
    }
  },

  // Smart sync item mutations
  async syncItemMutationsSmart(options = {}) {
    try {
      const { branchId, warehouseId, dateFrom, dateTo, dateFilterType = 'createDate', batchSize = 50, batchDelay = 300, mode = 'missing' } = options
      const params = { branchId, dateFilterType, batchSize, batchDelay, mode }
      
      if (warehouseId) {
        params.warehouseId = warehouseId
      }
      if (dateFrom) {
        params.dateFrom = dateFrom
      }
      if (dateTo) {
        params.dateTo = dateTo
      }
      
      const response = await axios.post(`${API_BASE}/item-mutations/sync-smart`, params)
      return response.data
    } catch (error) {
      console.error('Error syncing item mutations smart:', error)
      throw error
    }
  },

  // === PURCHASE INVOICE METHODS ===

  // Check purchase invoice sync status
  async checkPurchaseInvoiceSyncStatus(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, dateFilterType = 'createdDate' } = options
      const params = { branchId, dateFilterType }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/purchase-invoices/check-sync`, { params })
      return response.data
    } catch (error) {
      console.error('Error checking purchase invoice sync status:', error)
      throw error
    }
  },

  // Count purchase invoices (dry-run)
  async countPurchaseInvoices(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, dateFilterType = 'createdDate' } = options
      const params = { branchId, dateFilterType }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/purchase-invoices/count`, { params })
      return response.data
    } catch (error) {
      console.error('Error counting purchase invoices:', error)
      throw error
    }
  },

  // Smart sync: Only sync new + updated purchase invoices
  async syncPurchaseInvoicesSmart(options = {}) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'transDate',
        batchSize = 50,
        batchDelay = 300,
        mode = 'missing'
      } = options
      
      const params = { 
        branchId, 
        dateFilterType,
        batchSize,
        batchDelay,
        mode
      }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.post(`${API_BASE}/purchase-invoices/sync-smart`, null, { 
        params,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return response.data
    } catch (error) {
      console.error('Error syncing purchase invoices (smart):', error)
      throw error
    }
  },

  // Sync all purchase invoices (full sync)
  async syncPurchaseInvoices(options = {}) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'transDate',
        batchSize = 50,
        batchDelay = 300
      } = options
      
      const params = { 
        branchId, 
        dateFilterType,
        batchSize,
        batchDelay
      }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.post(`${API_BASE}/purchase-invoices/sync`, null, { 
        params,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return response.data
    } catch (error) {
      console.error('Error syncing purchase invoices:', error)
      throw error
    }
  },

  // Get synced purchase invoices from database
  async getPurchaseInvoices(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, vendorNo, limit = 100, offset = 0 } = options
      const params = { limit, offset }
      
      if (branchId) params.branchId = branchId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (vendorNo) params.vendorNo = vendorNo
      
      const response = await axios.get(`${API_BASE}/purchase-invoices`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching purchase invoices:', error)
      throw error
    }
  },

  // Get purchase invoice summary
  async getPurchaseInvoiceSummary(options = {}) {
    try {
      const { branchId, dateFrom, dateTo } = options
      const params = {}
      
      if (branchId) params.branchId = branchId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/purchase-invoices/summary/stats`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching purchase invoice summary:', error)
      throw error
    }
  }
,

  // === PURCHASE ORDER METHODS ===
  // Check sync status for purchase orders
  async checkPurchaseOrderSyncStatus(options = {}) {
    const { branchId, dateFrom, dateTo, dateFilterType = 'createdDate' } = options
    const params = { branchId, dateFilterType }
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    const res = await axios.get(`${API_BASE}/purchase-orders/check-sync`, { params })
    return res.data
  },
  // Sync purchase orders (non-stream)
  async syncPurchaseOrders(options = {}) {
    const { branchId, dateFrom, dateTo, dateFilterType='createdDate', batchSize=50, batchDelay=300, maxItems } = options
    const params = { branchId, dateFilterType, batchSize, batchDelay }
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    if(maxItems) params.maxItems = maxItems
    const res = await axios.post(`${API_BASE}/purchase-orders/sync`, params)
    return res.data
  },
  // Get purchase orders list from DB
  async getPurchaseOrders(options = {}) {
    const { branchId, dateFrom, dateTo, vendorNo, limit=100, offset=0 } = options
    const params = { limit, offset }
    if(branchId) params.branchId = branchId
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    if(vendorNo) params.vendorNo = vendorNo
    const res = await axios.get(`${API_BASE}/purchase-orders`, { params })
    return res.data
  },
  // Get purchase order summary
  async getPurchaseOrderSummary(options = {}) {
    const { branchId, dateFrom, dateTo } = options
    const params = {}
    if(branchId) params.branchId = branchId
    if(dateFrom) params.dateFrom = dateFrom
    if(dateTo) params.dateTo = dateTo
    const res = await axios.get(`${API_BASE}/purchase-orders/summary/stats`, { params })
    return res.data
  },

  // === SRP Item Master ===
  async syncSrpItemMaster(options = {}) {
    const {
      perPage,
      maxPages,
      pageDelay,
      truncateBeforeInsert,
    } = options

    const payload = {}
    if (perPage) payload.perPage = perPage
    if (maxPages) payload.maxPages = maxPages
    if (pageDelay !== undefined) payload.pageDelay = pageDelay
    if (truncateBeforeInsert !== undefined) payload.truncateBeforeInsert = truncateBeforeInsert

    const response = await axios.post(`${API_BASE}/srp/item-master/sync`, payload)
    return response.data
  },

  async getItemMasterRecords(options = {}) {
    const {
      search,
      entityCode,
      articleCode,
      perPage,
      page,
    } = options

    const params = {}
    if (search) params.search = search
    if (entityCode) params.entityCode = entityCode
    if (articleCode) params.articleCode = articleCode
    if (perPage) params.perPage = perPage
    if (page) params.page = page

    const response = await axios.get(`${API_BASE}/srp/item-master`, { params })
    return response.data
  },

  // === ITEM MUTATIONS METHODS ===

  // Check item mutations sync status
  async checkItemMutationsSync(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, dateFilterType = 'transDate' } = options
      const params = { branchId, dateFilterType }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/item-mutations/check-sync`, { params })
      return response.data
    } catch (error) {
      console.error('Error checking item mutations sync status:', error)
      throw error
    }
  },

  // Count item mutations (dry-run)
  async countItemMutations(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, dateFilterType = 'transDate' } = options
      const params = { branchId, dateFilterType }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/item-mutations/count`, { params })
      return response.data
    } catch (error) {
      console.error('Error counting item mutations:', error)
      throw error
    }
  },

  // Smart sync item mutations (only new + updated)
  async syncItemMutationsSmart(options = {}) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo,
        dateFilterType = 'transDate',
        batchSize = 50,
        batchDelay = 300,
        mode = 'missing'
      } = options
      
      const params = { 
        branchId,
        dateFilterType,
        batchSize,
        batchDelay,
        mode
      }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.post(`${API_BASE}/item-mutations/sync-smart`, {}, { 
        params,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      return response.data
    } catch (error) {
      console.error('Error in item mutations smart sync:', error)
      throw error
    }
  },

  // Sync all item mutations (full sync)
  async syncItemMutations(options = {}) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo,
        dateFilterType = 'transDate',
        batchSize = 50,
        batchDelay = 300,
        streamInsert = true,
        maxItems
      } = options
      
      const params = { 
        branchId,
        dateFilterType,
        batchSize,
        batchDelay,
        streamInsert: streamInsert ? 'true' : 'false'
      }
      
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (maxItems) params.maxItems = maxItems
      
      const response = await axios.post(`${API_BASE}/item-mutations/sync`, null, { params })
      return response.data
    } catch (error) {
      console.error('Error syncing item mutations:', error)
      throw error
    }
  },

  // Get synced item mutations from database
  async getItemMutations(options = {}) {
    try {
      const { branchId, dateFrom, dateTo, mutationType, warehouseId, limit = 100, offset = 0 } = options
      const params = { limit, offset }
      
      if (branchId) params.branchId = branchId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      if (mutationType) params.mutationType = mutationType
      if (warehouseId) params.warehouseId = warehouseId
      
      const response = await axios.get(`${API_BASE}/item-mutations`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching item mutations:', error)
      throw error
    }
  },

  // Get item mutation detail by ID
  async getItemMutationById(id) {
    try {
      const response = await axios.get(`${API_BASE}/item-mutations/${id}`)
      return response.data
    } catch (error) {
      console.error('Error fetching item mutation details:', error)
      throw error
    }
  },

  // Get item mutations summary statistics
  async getItemMutationsSummary(options = {}) {
    try {
      const { branchId, dateFrom, dateTo } = options
      const params = {}
      
      if (branchId) params.branchId = branchId
      if (dateFrom) params.dateFrom = dateFrom
      if (dateTo) params.dateTo = dateTo
      
      const response = await axios.get(`${API_BASE}/item-mutations/summary/stats`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching item mutations summary:', error)
      throw error
    }
  }
}

export default apiService
