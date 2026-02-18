<template>
  <div class="stock-on-hand">
    <h2>📦 Stock on Hand per Warehouse</h2>
    
    <!-- Branch Selection -->
    <div class="card">
      <h3>1. Pilih Cabang</h3>
      <div class="branch-selector">
        <select v-model="selectedBranch" @change="onBranchChange" class="select-input">
          <option value="">-- Pilih Cabang --</option>
          <option v-for="branch in branches" :key="branch.id" :value="branch.id">
            {{ branch.name }}
          </option>
        </select>
      </div>
      <p class="hint">{{ branches.length }} cabang tersedia</p>
    </div>

    <!-- Database Summary / Metadata -->
    <div class="card" v-if="selectedBranch && dbSummary">
      <h3>📊 Database Summary</h3>
      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="label">Total Records:</span>
          <span class="value">{{ dbSummary.total_records || 0 }}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Total Items:</span>
          <span class="value">{{ dbSummary.total_items || 0 }}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Warehouses:</span>
          <span class="value">{{ dbSummary.total_warehouses || 0 }}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Stock > 0:</span>
          <span class="value positive">{{ dbSummary.positive_stock || 0 }}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Stock < 0:</span>
          <span class="value negative">{{ dbSummary.negative_stock || 0 }}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Last Fetched:</span>
          <span class="value">{{ formatDate(dbSummary.last_fetched_at) }}</span>
        </div>
        <div class="metadata-item">
          <span class="label">Last Changed:</span>
          <span class="value">{{ formatDate(dbSummary.last_changed_at) }}</span>
        </div>
      </div>
      <button @click="loadFromDatabase" :disabled="loadingDB" class="btn btn-secondary" style="margin-top: 12px;">
        {{ loadingDB ? '⏳ Loading...' : '📂 Load from Database' }}
      </button>
    </div>

    <!-- Filter Options -->
    <div class="card" v-if="selectedBranch">
      <h3>2. Filter Options</h3>
      
      <div class="filter-grid">
        <div class="form-group">
          <label>Item Status:</label>
          <select v-model="itemFilter" class="select-input">
            <option value="active">Hanya Item Aktif</option>
            <option value="all">Semua Item</option>
          </select>
        </div>

        <div class="form-group">
          <label>Stock Filter:</label>
          <select v-model="stockFilter" class="select-input">
            <option value="hasStock">Stock != 0</option>
            <option value="all">Semua (termasuk 0)</option>
          </select>
        </div>

        <div class="form-group">
          <label>Warehouse:</label>
          <select v-model="selectedWarehouse" class="select-input">
            <option value="">Semua Warehouse</option>
            <option v-for="wh in warehouses" :key="wh.id" :value="wh.id">
              {{ wh.name }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Fetch Action -->
    <div class="card" v-if="selectedBranch">
      <h3>3. Fetch dari Accurate API</h3>
      
      <div class="button-group">
        <button @click="fetchStockOnHand" :disabled="fetching" class="btn btn-primary">
          {{ fetching ? '⏳ Fetching...' : '🔍 Fetch Stock on Hand' }}
        </button>
      </div>

      <!-- Progress -->
      <div v-if="fetching" class="progress-box">
        <div class="progress-header">
          <span>⏳ {{ progressStatus }}</span>
          <span>{{ progressPercent }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
        <p class="progress-text">{{ progressDetail }}</p>
      </div>
    </div>

    <!-- Results -->
    <div class="card" v-if="stockData.length > 0">
      <h3>4. Stock Data ({{ filteredStockData.length }} / {{ stockData.length }} records)</h3>
      
      <!-- Sync Status Summary -->
      <div class="sync-summary" v-if="syncStatus">
        <div class="sync-item new">
          <span class="sync-icon">🆕</span>
          <span class="sync-label">New:</span>
          <span class="sync-value">{{ syncStatus.new || 0 }}</span>
        </div>
        <div class="sync-item updated">
          <span class="sync-icon">🔄</span>
          <span class="sync-label">Updated:</span>
          <span class="sync-value">{{ syncStatus.updated || 0 }}</span>
        </div>
        <div class="sync-item unchanged">
          <span class="sync-icon">✅</span>
          <span class="sync-label">Unchanged:</span>
          <span class="sync-value">{{ syncStatus.unchanged || 0 }}</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-bar">
        <div class="action-group">
          <button @click="saveToDatabase" :disabled="saving" class="btn btn-success">
            {{ saving ? '⏳ Saving...' : '💾 Save to Database' }}
          </button>
        </div>
        <div class="action-group">
          <button @click="exportData('excel')" class="btn btn-export">📊 Excel</button>
          <button @click="exportData('csv')" class="btn btn-export">📄 CSV</button>
          <button @click="exportData('txt')" class="btn btn-export">📝 TXT</button>
        </div>
      </div>

      <!-- Save Result -->
      <div v-if="saveResult" class="result-box" :class="{ success: saveResult.success }">
        <p>{{ saveResult.message }}</p>
        <div class="result-details" v-if="saveResult.summary">
          <span>New: {{ saveResult.summary.new || 0 }}</span>
          <span>Updated: {{ saveResult.summary.updated || 0 }}</span>
          <span>Unchanged: {{ saveResult.summary.unchanged || 0 }}</span>
        </div>
      </div>

      <!-- Search & Filter -->
      <div class="search-filter-bar">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Cari kode/nama barang..." 
          class="search-input"
        />
        <select v-model="changeStatusFilter" class="select-input filter-select">
          <option value="all">Semua Status</option>
          <option value="changed">🔄 Yang Berubah (New + Updated)</option>
          <option value="new">🆕 Hanya New</option>
          <option value="updated">🔄 Hanya Updated</option>
          <option value="unchanged">✅ Hanya Unchanged</option>
        </select>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Status</th>
              <th>Kode Barang</th>
              <th>Nama Barang</th>
              <th>Kategori</th>
              <th>Unit</th>
              <th>Warehouse</th>
              <th>Quantity</th>
              <th v-if="hasUpdatedItems">Prev Qty</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="(item, index) in filteredStockData" 
              :key="item.itemId + '-' + item.warehouseId"
              :class="getRowClass(item)"
            >
              <td>{{ index + 1 }}</td>
              <td>
                <span class="status-badge" :class="item.syncStatus">
                  {{ getStatusLabel(item.syncStatus) }}
                </span>
              </td>
              <td>{{ item.itemNo }}</td>
              <td>{{ item.itemName }}</td>
              <td>{{ item.category }}</td>
              <td>{{ item.unitName }}</td>
              <td>{{ item.warehouseName }}</td>
              <td :class="{ 'negative': item.quantity < 0, 'positive': item.quantity > 0 }">
                {{ formatNumber(item.quantity) }}
              </td>
              <td v-if="hasUpdatedItems">
                <span v-if="item.previousQuantity !== null" class="prev-qty">
                  {{ formatNumber(item.previousQuantity) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-box">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import apiService from '../services/apiService'

export default {
  name: 'StockOnHand',
  props: {
    branches: {
      type: Array,
      required: true
    }
  },
  setup(props) {
    const selectedBranch = ref('')
    const itemFilter = ref('active')
    const stockFilter = ref('hasStock')
    const selectedWarehouse = ref('')
    const searchQuery = ref('')
    const changeStatusFilter = ref('all')
    
    const fetching = ref(false)
    const saving = ref(false)
    const loadingDB = ref(false)
    const progressStatus = ref('')
    const progressPercent = ref(0)
    const progressDetail = ref('')
    const error = ref('')
    
    const stockData = ref([])
    const dbSummary = ref(null)
    const saveResult = ref(null)
    const syncStatus = ref(null)
    
    const warehouses = ref([
      { id: 51, name: 'DC CIBITUNG' },
      { id: 500, name: 'DC CIBITUNG WET' },
      { id: 50, name: 'DC KRANGGAN' },
      { id: 550, name: 'DC KRANGGAN WET' },
      { id: 150, name: 'Damage CIBITUNG' },
      { id: 100, name: 'Damage KRANGGAN' }
    ])

    const hasUpdatedItems = computed(() => {
      return stockData.value.some(item => item.syncStatus === 'updated')
    })

    const filteredStockData = computed(() => {
      let data = stockData.value
      
      // Filter by change status
      if (changeStatusFilter.value === 'changed') {
        data = data.filter(item => item.syncStatus === 'new' || item.syncStatus === 'updated')
      } else if (changeStatusFilter.value === 'new') {
        data = data.filter(item => item.syncStatus === 'new')
      } else if (changeStatusFilter.value === 'updated') {
        data = data.filter(item => item.syncStatus === 'updated')
      } else if (changeStatusFilter.value === 'unchanged') {
        data = data.filter(item => item.syncStatus === 'unchanged')
      }
      
      // Filter by search query
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        data = data.filter(item => 
          item.itemNo?.toLowerCase().includes(query) ||
          item.itemName?.toLowerCase().includes(query)
        )
      }
      
      return data
    })

    const onBranchChange = async () => {
      stockData.value = []
      error.value = ''
      saveResult.value = null
      dbSummary.value = null
      syncStatus.value = null
      changeStatusFilter.value = 'all'
      
      if (selectedBranch.value) {
        await loadDbSummary()
        await loadWarehouses()
      }
    }

    const loadDbSummary = async () => {
      try {
        const result = await apiService.checkStockOnHandSync(selectedBranch.value)
        if (result.success) {
          dbSummary.value = result.data
        }
      } catch (err) {
        console.error('Error loading DB summary:', err)
      }
    }

    const loadWarehouses = async () => {
      try {
        const result = await apiService.getStockOnHandWarehouses(selectedBranch.value)
        if (result.success && result.data.length > 0) {
          warehouses.value = result.data.map(wh => ({
            id: wh.warehouse_id,
            name: wh.warehouse_name
          }))
        }
      } catch (err) {
        console.error('Error loading warehouses:', err)
      }
    }

    const loadFromDatabase = async () => {
      if (!selectedBranch.value) return
      
      loadingDB.value = true
      error.value = ''
      
      try {
        const result = await apiService.getStockOnHandFromDB({
          branchId: selectedBranch.value,
          warehouseId: selectedWarehouse.value || null,
          hasStock: stockFilter.value === 'hasStock' ? 'true' : null
        })
        
        if (result.success) {
          stockData.value = result.data.map(row => ({
            itemId: row.item_id,
            itemNo: row.item_no,
            itemName: row.item_name,
            category: row.category,
            unitName: row.unit_name,
            warehouseId: row.warehouse_id,
            warehouseName: row.warehouse_name,
            quantity: parseFloat(row.quantity),
            balanceUnit: row.balance_unit,
            lastFetchedAt: row.last_fetched_at,
            lastChangedAt: row.last_changed_at
          }))
        } else {
          error.value = result.error || 'Failed to load from database'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        loadingDB.value = false
      }
    }

    const fetchStockOnHand = async () => {
      if (!selectedBranch.value) {
        error.value = 'Pilih cabang terlebih dahulu'
        return
      }

      fetching.value = true
      error.value = ''
      stockData.value = []
      saveResult.value = null
      syncStatus.value = null
      changeStatusFilter.value = 'all'
      progressPercent.value = 0
      progressStatus.value = 'Memulai fetch...'
      progressDetail.value = ''

      try {
        const result = await apiService.fetchStockOnHand({
          branchId: selectedBranch.value,
          itemFilter: itemFilter.value,
          stockFilter: stockFilter.value,
          warehouseId: selectedWarehouse.value || null
        })

        if (result.success) {
          stockData.value = result.data || []
          syncStatus.value = result.syncStatus || null
          progressPercent.value = 100
          progressStatus.value = 'Selesai!'
          progressDetail.value = `${stockData.value.length} records ditemukan (${result.summary?.duration || ''})`
        } else {
          error.value = result.error || 'Failed to fetch stock data'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        fetching.value = false
      }
    }

    const saveToDatabase = async () => {
      if (!selectedBranch.value || stockData.value.length === 0) return
      
      saving.value = true
      saveResult.value = null
      
      try {
        const result = await apiService.saveStockOnHand(selectedBranch.value, stockData.value)
        
        saveResult.value = {
          success: result.success,
          message: result.message || (result.success ? 'Data saved successfully' : 'Failed to save'),
          summary: result.summary
        }
        
        if (result.success) {
          await loadDbSummary()
        }
      } catch (err) {
        saveResult.value = {
          success: false,
          message: err.message
        }
      } finally {
        saving.value = false
      }
    }

    const exportData = (format) => {
      if (stockData.value.length === 0) return
      
      const data = filteredStockData.value
      const filename = `stock_on_hand_${selectedBranch.value}_${new Date().toISOString().split('T')[0]}`
      
      if (format === 'excel' || format === 'csv') {
        const separator = format === 'csv' ? ',' : '\t'
        const headers = ['No', 'Kode Barang', 'Nama Barang', 'Kategori', 'Unit', 'Warehouse', 'Quantity']
        const rows = data.map((item, index) => [
          index + 1,
          item.itemNo,
          item.itemName,
          item.category,
          item.unitName,
          item.warehouseName,
          item.quantity
        ])
        
        const content = [headers, ...rows].map(row => row.join(separator)).join('\n')
        const blob = new Blob(['\ufeff' + content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.ms-excel;charset=utf-8' })
        downloadBlob(blob, `${filename}.${format === 'excel' ? 'xls' : 'csv'}`)
      } else if (format === 'txt') {
        const lines = data.map((item, index) => 
          `${index + 1}. ${item.itemNo} | ${item.itemName} | ${item.warehouseName} | Qty: ${item.quantity} ${item.unitName}`
        )
        const content = lines.join('\n')
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
        downloadBlob(blob, `${filename}.txt`)
      }
    }

    const downloadBlob = (blob, filename) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return '-'
      const date = new Date(dateStr)
      return date.toLocaleString('id-ID', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const formatNumber = (num) => {
      if (num === null || num === undefined) return '0'
      return parseFloat(num).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    }

    const getStatusLabel = (status) => {
      const labels = {
        'new': '🆕 New',
        'updated': '🔄 Updated',
        'unchanged': '✅'
      }
      return labels[status] || '-'
    }

    const getRowClass = (item) => {
      return {
        'row-new': item.syncStatus === 'new',
        'row-updated': item.syncStatus === 'updated'
      }
    }

    return {
      selectedBranch,
      itemFilter,
      stockFilter,
      selectedWarehouse,
      searchQuery,
      changeStatusFilter,
      warehouses,
      fetching,
      saving,
      loadingDB,
      progressStatus,
      progressPercent,
      progressDetail,
      error,
      stockData,
      filteredStockData,
      hasUpdatedItems,
      dbSummary,
      saveResult,
      syncStatus,
      onBranchChange,
      loadFromDatabase,
      fetchStockOnHand,
      saveToDatabase,
      exportData,
      formatDate,
      formatNumber,
      getStatusLabel,
      getRowClass
    }
  }
}
</script>


<style scoped>
.stock-on-hand {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.card h3 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 18px;
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #555;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.metadata-item {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.metadata-item .label {
  font-size: 11px;
  color: #666;
  text-transform: uppercase;
}

.metadata-item .value {
  font-size: 16px;
  font-weight: 600;
  color: #2c3e50;
}

.metadata-item .value.positive { color: #28a745; }
.metadata-item .value.negative { color: #dc3545; }

.branch-selector {
  display: flex;
  gap: 12px;
  align-items: center;
}

.select-input, .search-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.select-input:focus, .search-input:focus {
  outline: none;
  border-color: #42b983;
}

.hint {
  display: block;
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary { background: #42b983; color: white; }
.btn-primary:hover:not(:disabled) { background: #35a372; }

.btn-secondary { background: #6c757d; color: white; }
.btn-secondary:hover:not(:disabled) { background: #5a6268; }

.btn-success { background: #28a745; color: white; }
.btn-success:hover:not(:disabled) { background: #218838; }

.btn-export { background: #17a2b8; color: white; padding: 8px 12px; font-size: 12px; }
.btn-export:hover { background: #138496; }

.button-group, .action-group {
  display: flex;
  gap: 12px;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.search-box {
  margin-bottom: 16px;
}

.progress-box {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 4px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-weight: 500;
}

.progress-bar {
  height: 24px;
  background: #e9ecef;
  border-radius: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #42b983, #35a372);
  transition: width 0.3s;
}

.progress-text {
  margin-top: 8px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.result-box {
  margin-top: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #6c757d;
}

.result-box.success {
  background: #d4edda;
  border-left-color: #28a745;
}

.result-details {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

.error-box {
  padding: 16px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  margin-top: 16px;
}

.table-container {
  overflow-x: auto;
  max-height: 500px;
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table tr:hover {
  background: #f8f9fa;
}

.data-table td.negative {
  color: #dc3545;
  font-weight: 600;
}

.data-table td.positive {
  color: #28a745;
  font-weight: 600;
}

.sync-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 4px;
}

.sync-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sync-icon {
  font-size: 16px;
}

.sync-label {
  font-size: 13px;
  color: #666;
}

.sync-value {
  font-size: 16px;
  font-weight: 600;
}

.sync-item.new .sync-value { color: #28a745; }
.sync-item.updated .sync-value { color: #ffc107; }
.sync-item.unchanged .sync-value { color: #6c757d; }

.search-filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.search-filter-bar .search-input {
  flex: 1;
}

.filter-select {
  width: 250px;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.new {
  background: #d4edda;
  color: #155724;
}

.status-badge.updated {
  background: #fff3cd;
  color: #856404;
}

.status-badge.unchanged {
  background: #e9ecef;
  color: #6c757d;
}

.row-new {
  background: #f0fff4 !important;
}

.row-updated {
  background: #fffbeb !important;
}

.prev-qty {
  color: #999;
  font-size: 12px;
  text-decoration: line-through;
}
</style>
