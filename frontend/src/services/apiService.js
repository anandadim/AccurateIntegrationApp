import axios from 'axios'

const API_BASE = '/api'

const apiService = {
  async getBranches() {
    try {
      const response = await axios.get(`${API_BASE}/branches`)
      return response.data
    } catch (error) {
      console.error('Error fetching branches:', error)
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
  }
}

export default apiService
