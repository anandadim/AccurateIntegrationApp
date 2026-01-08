<template>
  <div class="item-mutations-sync">
    <h2>🔄 Item Mutations Sync Manager</h2>
    
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

    <!-- Check Sync Status -->
    <div class="card" v-if="selectedBranch">
      <h3>2. Cek Status Sync</h3>

      <div class="filters-grid">
        <div class="form-group">
          <label>Date From:</label>
          <input v-model="dateFrom" type="date" class="input-field" />
        </div>

        <div class="form-group">
          <label>Date To:</label>
          <input v-model="dateTo" type="date" class="input-field" />
        </div>
      </div>

      <button @click="checkSyncStatus" :disabled="checking" class="btn btn-primary">
        {{ checking ? '⏳ Checking...' : '🔍 Check Sync Status' }}
      </button>

      <!-- Check Result -->
      <div v-if="checkResult" class="result-box">
        <h4>📊 Sync Status:</h4>
        
        <div class="sync-status-grid">
          <div class="status-card new">
            <div class="status-icon">🆕</div>
            <div class="status-content">
              <div class="status-label">New</div>
              <div class="status-value">{{ checkResult.summary.new }}</div>
            </div>
          </div>
          
          <div class="status-card updated">
            <div class="status-icon">🔄</div>
            <div class="status-content">
              <div class="status-label">Updated</div>
              <div class="status-value">{{ checkResult.summary.updated }}</div>
            </div>
          </div>
          
          <div class="status-card unchanged">
            <div class="status-icon">✅</div>
            <div class="status-content">
              <div class="status-label">Unchanged</div>
              <div class="status-value">{{ checkResult.summary.unchanged }}</div>
            </div>
          </div>
          
          <div class="status-card total">
            <div class="status-icon">📦</div>
            <div class="status-content">
              <div class="status-label">Total</div>
              <div class="status-value">{{ checkResult.summary.total }}</div>
            </div>
          </div>
        </div>

        <div class="sync-recommendation">
          <p v-if="checkResult.summary.needSync > 0" class="need-sync">
            ⚠️ Need to sync: <strong>{{ checkResult.summary.needSync }}</strong> mutations
          </p>
          <p v-else class="up-to-date">
            ✅ All data is up to date
          </p>
        </div>
      </div>
    </div>

    <!-- Sync Options -->
    <div class="card" v-if="selectedBranch">
      <h3>3. Sync Options</h3>
      
      <div class="form-group">
        <label>Warehouse:</label>
        <select v-model="selectedWarehouse" class="select-input">
          <option value="">All Warehouses</option>
          <option value="51">Warehouse ID 51</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Batch Size:</label>
        <input v-model="batchSize" type="number" min="10" max="100" class="input-field" />
      </div>

      <div class="form-group">
        <label>Batch Delay (ms):</label>
        <input v-model="batchDelay" type="number" min="100" max="2000" class="input-field" />
      </div>

      <div class="button-group">
        <button @click="syncSmart" :disabled="syncing" class="btn btn-success">
          {{ syncing ? '⏳ Syncing...' : '🚀 Smart Sync' }}
        </button>
        
        <button @click="syncAll" :disabled="syncing" class="btn btn-warning">
          {{ syncing ? '⏳ Syncing...' : '🔄 Sync All' }}
        </button>
      </div>

      <!-- Sync Results -->
      <div v-if="syncResult" class="result-box">
        <h4>✅ Sync Results</h4>
        <p><strong>Branch:</strong> {{ syncResult.branch }}</p>
        <p><strong>Synced:</strong> {{ syncResult.synced }}</p>
        <p><strong>Fetch Errors:</strong> {{ syncResult.fetchErrors }}</p>
        <p><strong>Save Errors:</strong> {{ syncResult.saveErrors }}</p>
        <p><strong>Duration:</strong> {{ syncResult.duration }}</p>
      </div>
    </div>

    <!-- Query Mutations -->
    <div class="card" v-if="selectedBranch">
      <h3>4. Query Mutations</h3>
      
      <div class="form-group">
        <label>Warehouse:</label>
        <select v-model="selectedWarehouse" class="select-input">
          <option value="">All Warehouses</option>
          <option value="51">Warehouse ID 51</option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Mutation Type:</label>
        <select v-model="mutationType" class="select-input">
          <option value="">All Types</option>
          <option value="ADJUSTMENT">Adjustment</option>
          <option value="TRANSFER">Transfer</option>
          <option value="PRODUCTION">Production</option>
          <option value="CONSUMPTION">Consumption</option>
        </select>
      </div>

      <button @click="queryMutations" :disabled="querying" class="btn btn-primary">
        {{ querying ? '⏳ Querying...' : '🔍 Query Mutations' }}
      </button>

      <!-- Query Results -->
      <div v-if="queryResults.length > 0" class="results-table">
        <h4>📋 Results ({{ queryResults.length }} mutations)</h4>
        <table>
          <thead>
            <tr>
              <th>Mutation Number</th>
              <th>Date</th>
              <th>Type</th>
              <th>Warehouse</th>
              <th>Total Qty</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mutation in queryResults" :key="mutation.id">
              <td>{{ mutation.mutation_number }}</td>
              <td>{{ mutation.trans_date }}</td>
              <td>{{ mutation.mutation_type }}</td>
              <td>{{ mutation.warehouse_name }}</td>
              <td>{{ mutation.total_quantity }}</td>
              <td>{{ formatCurrency(mutation.total_value) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-box">
      <h4>❌ Error:</h4>
      <p>{{ error }}</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import apiService from '../services/apiService'

export default {
  name: 'ItemMutationsSync',
  props: {
    branches: {
      type: Array,
      required: true
    }
  },
  setup() {
    const selectedBranch = ref('')
    const selectedWarehouse = ref('')
    const mutationType = ref('')
    const dateFrom = ref('')
    const dateTo = ref('')
    
    const checking = ref(false)
    const syncing = ref(false)
    const querying = ref(false)
    
    const checkResult = ref(null)
    const syncResult = ref(null)
    const queryResults = ref([])
    const error = ref('')
    
    const batchSize = ref(20)
    const batchDelay = ref(300)
    const syncProgress = ref(0)
    const syncMessage = ref('')

    const checkSyncStatus = async () => {
      if (!selectedBranch.value) {
        error.value = 'Please select a branch first'
        return
      }

      checking.value = true
      error.value = ''
      checkResult.value = null

      try {
        const result = await apiService.checkItemMutationsSync({
          branchId: selectedBranch.value,
          warehouseId: selectedWarehouse.value || undefined,
          dateFrom: dateFrom.value || undefined,
          dateTo: dateTo.value || undefined
        })
        
        if (result.success) {
          checkResult.value = result
        } else {
          error.value = result.error || 'Failed to check sync status'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        checking.value = false
      }
    }

    const syncSmart = async () => {
      if (!selectedBranch.value) {
        error.value = 'Please select a branch first'
        return
      }

      syncing.value = true
      error.value = ''
      syncResult.value = null
      syncProgress.value = 0
      syncMessage.value = 'Starting smart sync...'

      try {
        const result = await apiService.syncItemMutationsSmart({
          branchId: selectedBranch.value,
          warehouseId: selectedWarehouse.value || undefined,
          dateFrom: dateFrom.value || undefined,
          dateTo: dateTo.value || undefined,
          batchSize: batchSize.value,
          batchDelay: batchDelay.value,
          mode: 'missing'
        })
        
        if (result.success) {
          syncResult.value = result.summary
          syncMessage.value = 'Smart sync completed!'
          syncProgress.value = 100
          
          // Refresh check status
          await checkSyncStatus()
        } else {
          error.value = result.error || 'Failed to sync mutations'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        syncing.value = false
      }
    }

    const syncAll = async () => {
      if (!selectedBranch.value) {
        error.value = 'Please select a branch first'
        return
      }

      syncing.value = true
      error.value = ''
      syncResult.value = null
      syncProgress.value = 0
      syncMessage.value = 'Starting full sync...'

      try {
        const result = await apiService.syncItemMutationsSmart({
          branchId: selectedBranch.value,
          warehouseId: selectedWarehouse.value || undefined,
          dateFrom: dateFrom.value || undefined,
          dateTo: dateTo.value || undefined,
          batchSize: batchSize.value,
          batchDelay: batchDelay.value,
          mode: 'all'
        })
        
        if (result.success) {
          syncResult.value = result.summary
          syncMessage.value = 'Full sync completed!'
          syncProgress.value = 100
          
          // Refresh check status
          await checkSyncStatus()
        } else {
          error.value = result.error || 'Failed to sync mutations'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        syncing.value = false
      }
    }

    const queryMutations = async () => {
      if (!selectedBranch.value) {
        error.value = 'Please select a branch first'
        return
      }

      querying.value = true
      error.value = ''
      queryResults.value = []

      try {
        const result = await apiService.getItemMutations({
          branchId: selectedBranch.value,
          warehouseId: selectedWarehouse.value || undefined,
          mutationType: mutationType.value,
          limit: 100
        })
        
        if (result.success) {
          queryResults.value = result.data
        } else {
          error.value = result.error || 'Failed to query mutations'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        querying.value = false
      }
    }

    const formatCurrency = (value) => {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
      }).format(value)
    }

    const onBranchChange = () => {
      checkResult.value = null
      syncResult.value = null
      queryResults.value = []
      error.value = ''
      selectedWarehouse.value = ''
      mutationType.value = ''
      dateFrom.value = ''
      dateTo.value = ''
    }

    return {
      selectedBranch,
      selectedWarehouse,
      mutationType,
      dateFrom,
      dateTo,
      checking,
      syncing,
      querying,
      checkResult,
      syncResult,
      queryResults,
      error,
      batchSize,
      batchDelay,
      syncProgress,
      syncMessage,
      checkSyncStatus,
      syncSmart,
      syncAll,
      queryMutations,
      formatCurrency,
      onBranchChange
    }
  }
}
</script>

<style scoped>
.item-mutations-sync {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card h3 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 18px;
  margin-bottom: 16px;
}

.card h4 {
  color: #34495e;
  margin-bottom: 12px;
}

.branch-selector {
  margin-bottom: 12px;
}

.select-input,
.date-input,
.number-input {
  width: 100%;
  max-width: 300px;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.select-input:focus,
.date-input:focus,
.number-input:focus {
  outline: none;
  border-color: #42b983;
}

.hint {
  font-size: 12px;
  color: #7f8c8d;
  margin: 4px 0 0;
}

.date-filter {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #34495e;
  font-size: 14px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-right: 8px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #42b983;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #3aa876;
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #229954;
}

.btn-warning {
  background: #f39c12;
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: #d68910;
}

.button-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.result-box {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.sync-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.status-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.status-icon {
  font-size: 24px;
}

.status-content {
  flex: 1;
}

.status-label {
  font-size: 12px;
  color: #7f8c8d;
  margin-bottom: 4px;
}

.status-value {
  font-size: 20px;
  font-weight: 700;
  color: #2c3e50;
}

.status-card.new .status-value { color: #3498db; }
.status-card.updated .status-value { color: #f39c12; }
.status-card.unchanged .status-value { color: #27ae60; }
.status-card.total .status-value { color: #2c3e50; }

.sync-recommendation {
  margin-top: 12px;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
}

.need-sync {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.up-to-date {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.progress-bar {
  width: 100%;
  height: 24px;
  background: #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  margin: 12px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #42b983 0%, #3aa876 100%);
  transition: width 0.3s ease;
}

.progress-text {
  text-align: center;
  color: #7f8c8d;
  font-size: 14px;
  margin: 8px 0;
}

.result-summary {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
}

.result-summary p {
  margin: 8px 0;
  color: #34495e;
}

.results-table {
  margin-top: 16px;
  overflow-x: auto;
}

.results-table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.results-table th,
.results-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.results-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #2c3e50;
}

.results-table tbody tr:hover {
  background: #f8f9fa;
}

.error-box {
  background: #ffebee;
  border: 1px solid #ffcdd2;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.error-box h4 {
  color: #c62828;
  margin: 0 0 8px;
}

.error-box p {
  color: #c62828;
  margin: 0;
}
</style>
