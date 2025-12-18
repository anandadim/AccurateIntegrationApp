<template>
  <div class="order-sync">
    <h2>📦 Sales Order Sync Manager</h2>
    
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

    <!-- Date Range & Check -->
    <div class="card" v-if="selectedBranch">
      <h3>2. Cek Status Sync</h3>
      
      <div class="form-group">
        <label>Dari Tanggal:</label>
        <input type="date" v-model="dateFrom" class="date-input">
      </div>
      
      <div class="form-group">
        <label>Sampai Tanggal:</label>
        <input type="date" v-model="dateTo" class="date-input">
      </div>

      <div class="form-group">
        <label>Filter Type:</label>
        <select v-model="dateFilterType" class="select-input">
          <option value="transDate">Transaction Date</option>
          <option value="createdDate">Created Date</option>
          <option value="modifiedDate">Modified Date</option>
        </select>
      </div>
      
      <button @click="checkSync" :disabled="checking" class="btn btn-primary">
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

         <!-- Error Display -->
        <div v-if="error" class="error-box">
          ❌ {{ error }}
        </div>

        <div class="sync-recommendation">
          <p v-if="checkResult.summary.needSync > 0" class="need-sync">
            ⚠️ Need to sync: <strong>{{ checkResult.summary.needSync }}</strong> orders
          </p>
          <p v-else class="up-to-date">
            ✅ All data is up-to-date!
          </p>
        </div>
      </div>
    </div>

    <!-- Sync Actions -->
    <div class="card" v-if="selectedBranch">
      <h3>3. Sync Sales Order</h3>
      
      <div class="form-group">
        <label>Batch Size:</label>
        <input type="number" v-model.number="batchSize" min="10" max="50" class="number-input">
        <span class="hint">Items per batch (10-50, recommended: 20)</span>
      </div>

      <div class="form-group">
        <label>Batch Delay (ms):</label>
        <input type="number" v-model.number="batchDelay" min="100" max="2000" step="100" class="number-input">
        <span class="hint">Delay between batches (recommended: 500ms)</span>
      </div>

      <div class="button-group">
        <button 
          @click="syncSmartMissing" 
          :disabled="syncing || !checkResult || checkResult.summary.needSync === 0" 
          class="btn btn-success"
        >
          {{ syncing ? '⏳ Syncing...' : `⚡ Sync Missing (${checkResult?.summary.needSync || 0})` }}
        </button>
        
        <button 
          @click="syncSmartAll" 
          :disabled="syncing || !checkResult" 
          class="btn btn-warning"
        >
          {{ syncing ? '⏳ Syncing...' : `🔄 Re-sync All (${checkResult?.summary.total || 0})` }}
        </button>
      </div>

      <!-- Sync Progress -->
      <div v-if="syncing" class="progress-box">
        <div class="progress-header">
          <span>⏳ Syncing in progress...</span>
          <span>{{ syncProgress }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: syncProgress + '%' }"></div>
        </div>
        <p class="progress-text">{{ syncStatus }}</p>
      </div>

      <!-- Sync Result -->
      <div v-if="syncResult" class="result-box" :class="syncResult.errors && syncResult.errors.length ? 'warning' : 'success'">
        <h4>✅ Sync Completed!</h4>
        <div class="result-grid">
          <div class="result-item">
            <span class="label">Synced:</span>
            <span class="value success-text">{{ syncResult.summary.synced }}</span>
          </div>
          <div class="result-item">
            <span class="label">Fetch Errors:</span>
            <span class="value error-text">{{ syncResult.summary.fetchErrors || 0 }}</span>
          </div>
          <div class="result-item">
            <span class="label">Save Errors:</span>
            <span class="value error-text">{{ syncResult.summary.saveErrors || 0 }}</span>
          </div>
          <div class="result-item">
            <span class="label">Duration:</span>
            <span class="value">{{ syncResult.summary.duration }}</span>
          </div>
        </div>

        <!-- Error Details -->
        <div v-if="syncResult.errors && syncResult.errors.length" class="error-details">
          <h4>⚠️ Errors ({{ syncResult.errors.length }})</h4>
          <ul>
            <li v-for="err in syncResult.errors.slice(0, 10)" :key="`${err.stage}-${err.id}`">
              <strong>{{ err.stage }} ➜ ID {{ err.id }}:</strong> {{ err.message }}
            </li>
          </ul>
          <p v-if="syncResult.errors.length > 10" class="hint">Showing first 10 errors.</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import { ref, computed } from 'vue'
import apiService from '../services/apiService'

export default {
  name: 'SalesOrderSync',
  props: {
    branches: {
      type: Array,
      required: true
    }
  },
  setup(props) {
    const selectedBranch = ref('')
    const today = new Date().toISOString().split('T')[0]
    const dateFrom = ref(today)
    const dateTo = ref(today)
    const dateFilterType = ref('transDate')
    const batchSize = ref(20)
    const batchDelay = ref(500)
    
    const checking = ref(false)
    const syncing = ref(false)
    const checkResult = ref(null)
    const syncResult = ref(null)
    const syncProgress = ref(0)
    const syncStatus = ref('')
    const error = ref('')

    const selectedBranchData = computed(() => {
      return props.branches.find(b => b.id === selectedBranch.value)
    })

    const onBranchChange = () => {
      checkResult.value = null
      syncResult.value = null
      error.value = ''
    }

    const checkSync = async () => {
      if (!selectedBranch.value) {
        error.value = 'Pilih cabang terlebih dahulu'
        return
      }

      checking.value = true
      error.value = ''
      checkResult.value = null
      // Don't clear syncResult here; checkSync() is also called after sync to refresh status,
      // and clearing it would make error details disappear from the UI.

      try {
        const result = await apiService.checkOrderSyncStatus({
          branchId: selectedBranch.value,
          dateFrom: dateFrom.value,
          dateTo: dateTo.value,
          dateFilterType: dateFilterType.value
        })

        if (result.success) {
          checkResult.value = result
          console.log('✅ Check result updated:', result.summary)
        } else {
          error.value = result.error || 'Failed to check sync status'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        checking.value = false
      }
    }

    const syncSmartMissing = async () => {
      await syncSmart('missing')
    }

    const syncSmartAll = async () => {
      await syncSmart('all')
    }

    const syncSmart = async (mode) => {
      if (!selectedBranch.value) {
        error.value = 'Pilih cabang terlebih dahulu'
        return
      }

      if (!checkResult.value) {
        error.value = 'Please check sync status first'
        return
      }

      syncing.value = true
      error.value = ''
      syncResult.value = null
      syncProgress.value = 0
      syncStatus.value = mode === 'missing' ? 'Syncing missing orders...' : 'Re-syncing all orders...'

      try {
        console.log('🚀 Starting order sync...', { mode, branchId: selectedBranch.value })
        
        const progressInterval = setInterval(() => {
          if (syncProgress.value < 90) {
            syncProgress.value += 5
            syncStatus.value = `Syncing... ${syncProgress.value}%`
          }
        }, 1000)

        const result = await apiService.syncOrdersSmart({
          branchId: selectedBranch.value,
          dateFrom: dateFrom.value,
          dateTo: dateTo.value,
          dateFilterType: dateFilterType.value,
          batchSize: batchSize.value,
          batchDelay: batchDelay.value,
          mode: mode
        })

        console.log('✅ Sync result:', result)

        clearInterval(progressInterval)
        syncProgress.value = 100
        syncStatus.value = 'Completed!'

        if (result.success) {
          syncResult.value = result
          console.log('🔄 Refreshing check result...')
          // Wait a bit for database to commit
          await new Promise(resolve => setTimeout(resolve, 1000))
          await checkSync()
        } else {
          console.error('❌ Sync failed:', result.error)
          error.value = result.error || 'Failed to sync orders'
        }
      } catch (err) {
        console.error('❌ Sync error:', err)
        error.value = err.message
      } finally {
        syncing.value = false
      }
    }

    return {
      selectedBranch,
      dateFrom,
      dateTo,
      dateFilterType,
      batchSize,
      batchDelay,
      checking,
      syncing,
      checkResult,
      syncResult,
      syncProgress,
      syncStatus,
      error,
      selectedBranchData,
      onBranchChange,
      checkSync,
      syncSmartMissing,
      syncSmartAll
    }
  }
}
</script>

<style scoped>
.order-sync {
  max-width: 900px;
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

.branch-selector {
  display: flex;
  gap: 12px;
  align-items: center;
}

.select-input, .date-input, .number-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.select-input:focus, .date-input:focus, .number-input:focus {
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

.btn-primary {
  background: #42b983;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #35a372;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn-warning {
  background: #ffc107;
  color: #333;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.button-group {
  display: flex;
  gap: 12px;
}

.button-group .btn {
  flex: 1;
}

.result-box {
  border-left: 4px solid #42b983;
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 4px;
}

.result-box.success {
  border-left-color: #28a745;
  background: #d4edda;
}

.result-box h4 {
  margin-top: 0;
  margin-bottom: 12px;
  color: #2c3e50;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  background: white;
  border-radius: 4px;
}

.result-item .label {
  font-weight: 500;
  color: #666;
}

.result-item .value {
  font-weight: 600;
  color: #2c3e50;
}

.success-text {
  color: #28a745 !important;
}

.error-text {
  color: #dc3545 !important;
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

.error-box {
  padding: 16px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
  margin-top: 16px;
}

.sync-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  background: white;
  border: 2px solid #e0e0e0;
}

.status-card.new {
  border-color: #4caf50;
  background: #f1f8f4;
}

.status-card.updated {
  border-color: #ff9800;
  background: #fff8f0;
}

.status-card.unchanged {
  border-color: #2196f3;
  background: #f0f7ff;
}

.status-card.total {
  border-color: #9c27b0;
  background: #f8f0ff;
}

.status-icon {
  font-size: 24px;
}

.status-content {
  flex: 1;
}

.status-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  font-weight: 500;
}

.status-value {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
}

.sync-recommendation {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.sync-recommendation .need-sync {
  background: #fff3cd;
  border: 1px solid #ffc107;
  padding: 12px;
  border-radius: 4px;
  color: #856404;
  margin: 0;
}

.sync-recommendation .up-to-date {
  background: #d4edda;
  border: 1px solid #28a745;
  padding: 12px;
  border-radius: 4px;
  color: #155724;
  margin: 0;
}
.result-box.warning {
  border-left-color: #e67e22;
}

.error-details {
  margin-top: 16px;
  background: #fff7e6;
  border: 1px solid #f1c40f;
  border-radius: 4px;
  padding: 12px;
}
.error-details ul {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
  font-size: 14px;
  color: #d35400;
}
.error-details li + li {
  margin-top: 4px;
}

</style>
