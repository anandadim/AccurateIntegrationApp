import axios from 'axios'

const API_BASE = '/api'

const apiService = {
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

  // Sync item from Accurate API
  async syncItem(itemId, options = {}) {
    try {
      const { db, branch } = options
      const params = { db }
      
      if (branch) params.branch = branch
      
      const response = await axios.post(`${API_BASE}/items/${itemId}/sync`, {}, { params })
      return response.data
    } catch (error) {
      console.error('Error syncing item:', error)
      throw error
    }
  }
}

export default apiService
