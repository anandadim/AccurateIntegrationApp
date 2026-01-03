<template>
  <div class="sync-manager">
    <h2>🔄 Sales Invoice Sync Manager</h2>
    
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
        <button @click="reloadBranches" :disabled="reloading" class="btn btn-secondary">
          {{ reloading ? '⏳' : '🔄' }} Reload
        </button>
      </div>
      <p class="hint">{{ branches.length }} cabang tersedia</p>
    </div>

    <!-- Date Range & Count -->
    <div class="card" v-if="selectedBranch">
      <h3>2. Cek Jumlah Invoice (Dry-Run)</h3>
      
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
          <option value="createdDate">Created Date</option>
          <option value="transDate">Transaction Date</option>
          <option value="modifiedDate">Modified Date</option>
        </select>
      </div>
      
      <button @click="checkSync" :disabled="checking" class="btn btn-primary">
        {{ checking ? '⏳ Checking...' : '🔍 Check Sync Status' }}
      </button>

      <!-- Check Sync Result -->
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
            <div class="status-icon">📊</div>
            <div class="status-content">
              <div class="status-label">Total</div>
              <div class="status-value">{{ checkResult.summary.total }}</div>
            </div>
          </div>
        </div>

        <div class="sync-recommendation">
          <p v-if="checkResult.summary.needSync > 0" class="need-sync">
            ⚠️ Need to sync: <strong>{{ checkResult.summary.needSync }}</strong> invoices
            ({{ checkResult.summary.new }} new + {{ checkResult.summary.updated }} updated)
          </p>
          <p v-else class="up-to-date">
            ✅ All data is up-to-date! No sync needed.
          </p>
        </div>

        <!-- Invoice Lists -->
        <div v-if="checkResult.invoices.new.length > 0" class="invoice-list">
          <h5>🆕 New Invoices ({{ checkResult.summary.new }}):</h5>
          <div class="invoice-chips">
            <span v-for="inv in checkResult.invoices.new" :key="inv.id" class="invoice-chip">
              {{ inv.number }}
            </span>
            <span v-if="checkResult.invoices.hasMore.new" class="more-chip">
              +{{ checkResult.summary.new - checkResult.invoices.new.length }} more
            </span>
          </div>
        </div>

        <div v-if="checkResult.invoices.updated.length > 0" class="invoice-list">
          <h5>🔄 Updated Invoices ({{ checkResult.summary.updated }}):</h5>
          <div class="invoice-chips">
            <span v-for="inv in checkResult.invoices.updated" :key="inv.id" class="invoice-chip">
              {{ inv.number }}
            </span>
            <span v-if="checkResult.invoices.hasMore.updated" class="more-chip">
              +{{ checkResult.summary.updated - checkResult.invoices.updated.length }} more
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sync Actions -->
    <div class="card" v-if="selectedBranch">
      <h3>3. Sync Invoice</h3>
      
      <div class="form-group">
        <label>Batch Size:</label>
        <input type="number" v-model.number="batchSize" min="10" max="100" class="number-input">
        <span class="hint">Items per batch (10-100)</span>
      </div>

      <div class="form-group">
        <label>Batch Delay (ms):</label>
        <input type="number" v-model.number="batchDelay" min="100" max="1000" step="100" class="number-input">
        <span class="hint">Delay between batches</span>
      </div>

      <div class="form-group">
        <label>
          <input type="checkbox" v-model="streamInsert">
          Stream Insert (insert per batch)
        </label>
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
        
        <button @click="syncByMonth" :disabled="syncing" class="btn btn-info">
          📅 Sync Per Month
        </button>
      </div>
    </div>

    <!-- Extract Relations -->
    <div class="card" v-if="selectedBranch">
      <h3>4. Extract Relations (SI-SO-SR)</h3>
      <p class="hint">Extract relations from existing database records (raw_data)</p>
      
      <div class="button-group">
        <button 
          @click="checkRelationsStatus" 
          :disabled="checkingRelations" 
          class="btn btn-info"
        >
          {{ checkingRelations ? '⏳ Checking...' : '🔍 Check Relations Status' }}
        </button>
        
        <button 
          @click="extractRelations" 
          :disabled="extracting" 
          class="btn btn-primary"
        >
          {{ extracting ? '⏳ Extracting...' : '🔗 Extract Relations' }}
        </button>
      </div>

      <!-- Check Relations Status Result -->
      <div v-if="checkRelationsResult" class="result-box">
        <h4>📊 Relations Status:</h4>
        
        <div class="sync-status-grid">
          <div class="status-card new">
            <div class="status-icon">🆕</div>
            <div class="status-content">
              <div class="status-label">New</div>
              <div class="status-value">{{ checkRelationsResult.summary.new }}</div>
            </div>
          </div>
          
          <div class="status-card updated">
            <div class="status-icon">🔄</div>
            <div class="status-content">
              <div class="status-label">Updated</div>
              <div class="status-value">{{ checkRelationsResult.summary.updated }}</div>
            </div>
          </div>
          
          <div class="status-card unchanged">
            <div class="status-icon">✅</div>
            <div class="status-content">
              <div class="status-label">Unchanged</div>
              <div class="status-value">{{ checkRelationsResult.summary.unchanged }}</div>
            </div>
          </div>
          
          <div class="status-card total">
            <div class="status-icon">📊</div>
            <div class="status-content">
              <div class="status-label">Total</div>
              <div class="status-value">{{ checkRelationsResult.summary.total }}</div>
            </div>
          </div>
        </div>

        <!-- New Relations List -->
        <div v-if="checkRelationsResult.invoices.new.length > 0" class="invoice-list">
          <h5>🆕 New Relations ({{ checkRelationsResult.summary.new }}):</h5>
          <div class="invoice-chips">
            <span v-for="rel in checkRelationsResult.invoices.new" :key="rel.sales_receipt" class="invoice-chip">
              {{ rel.invoice_number }} - {{ rel.sales_receipt }}
            </span>
            <span v-if="checkRelationsResult.invoices.hasMore.new" class="more-chip">
              +{{ checkRelationsResult.summary.new - checkRelationsResult.invoices.new.length }} more
            </span>
          </div>
        </div>

        <!-- Updated Relations List -->
        <div v-if="checkRelationsResult.invoices.updated.length > 0" class="invoice-list">
          <h5>🔄 Updated Relations ({{ checkRelationsResult.summary.updated }}):</h5>
          <div class="invoice-chips">
            <span v-for="rel in checkRelationsResult.invoices.updated" :key="rel.sales_receipt" class="invoice-chip">
              {{ rel.invoice_number }} - {{ rel.sales_receipt }}
            </span>
            <span v-if="checkRelationsResult.invoices.hasMore.updated" class="more-chip">
              +{{ checkRelationsResult.summary.updated - checkRelationsResult.invoices.updated.length }} more
            </span>
          </div>
        </div>
      </div>

      <!-- Extract Progress -->
      <div v-if="extracting" class="progress-box">
        <div class="progress-header">
          <span>⏳ Extracting in progress...</span>
        </div>
        <p class="progress-text">{{ extractStatus }}</p>
      </div>

      <!-- Extract Result -->
      <div v-if="extractResult" class="result-box success">
        <h4>✅ Extract Completed!</h4>
        <div class="result-grid">
          <div class="result-item">
            <span class="label">Invoices Processed:</span>
            <span class="value success-text">{{ extractResult.summary.invoicesProcessed }}</span>
          </div>
          <div class="result-item">
            <span class="label">Relations Extracted:</span>
            <span class="value success-text">{{ extractResult.summary.relationsExtracted }}</span>
          </div>
          <div class="result-item">
            <span class="label">Errors:</span>
            <span class="value error-text">{{ extractResult.summary.errors }}</span>
          </div>
          <div class="result-item">
            <span class="label">Duration:</span>
            <span class="value">{{ extractResult.summary.duration }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sync Progress (moved from Extract section) -->
    <div class="card" v-if="selectedBranch && syncing">
      <div class="progress-box">
        <div class="progress-header">
          <span>⏳ Syncing in progress...</span>
          <span>{{ syncProgress }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: syncProgress + '%' }"></div>
        </div>
        <p class="progress-text">{{ syncStatus }}</p>
      </div>
    </div>

    <!-- Sync Result (moved from Extract section) -->
    <div class="card" v-if="selectedBranch && syncResult">
      <div class="result-box success">
        <h4>✅ Sync Completed!</h4>
        <div class="result-grid">
          <div class="result-item">
            <span class="label">Saved:</span>
            <span class="value success-text">{{ syncResult.summary.saved }}</span>
          </div>
          <div class="result-item">
            <span class="label">Errors:</span>
            <span class="value error-text">{{ syncResult.summary.errors }}</span>
          </div>
          <div class="result-item">
            <span class="label">Duration:</span>
            <span class="value">{{ syncResult.summary.duration }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Monthly Sync Helper -->
    <div class="card" v-if="showMonthlyHelper">
      <h3>📅 Sync Per Bulan</h3>
      <p class="hint">Pilih bulan yang ingin di-sync:</p>
      
      <div class="month-grid">
        <button 
          v-for="month in monthList" 
          :key="month.value"
          @click="syncMonth(month)"
          :disabled="syncing || month.synced"
          :class="['month-btn', { synced: month.synced, syncing: month.syncing }]"
        >
          <span class="month-name">{{ month.name }}</span>
          <span v-if="month.synced" class="status">✅</span>
          <span v-else-if="month.syncing" class="status">⏳</span>
        </button>
      </div>

      <button @click="syncAllMonths" :disabled="syncing" class="btn btn-warning">
        🔄 Sync All Months
      </button>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="error-box">
      ❌ {{ error }}
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import apiService from '../services/apiService'

export default {
  name: 'SyncManager',
  props: {
    branches: {
      type: Array,
      required: true
    }
  },
  setup(props) {
    const selectedBranch = ref('')
    // Default to today
    const today = new Date().toISOString().split('T')[0]
    const dateFrom = ref(today)
    const dateTo = ref(today)
    const dateFilterType = ref('transDate')  // Changed to transDate (more common)
    const batchSize = ref(20)  // Reduced from 50 to 20 to avoid server overload
    const batchDelay = ref(500)  // Increased from 300ms to 500ms for better stability
    const streamInsert = ref(true)
    
    const checking = ref(false)
    const syncing = ref(false)
    const reloading = ref(false)
    const extracting = ref(false)
    const checkingRelations = ref(false)
    const checkResult = ref(null)
    const syncResult = ref(null)
    const extractResult = ref(null)
    const checkRelationsResult = ref(null)
    const syncProgress = ref(0)
    const syncStatus = ref('')
    const extractStatus = ref('')
    const error = ref('')
    const showMonthlyHelper = ref(false)

    const monthList = ref([
      { name: 'Januari', value: '01', from: '2025-01-01', to: '2025-01-31', synced: false, syncing: false },
      { name: 'Februari', value: '02', from: '2025-02-01', to: '2025-02-28', synced: false, syncing: false },
      { name: 'Maret', value: '03', from: '2025-03-01', to: '2025-03-31', synced: false, syncing: false },
      { name: 'April', value: '04', from: '2025-04-01', to: '2025-04-30', synced: false, syncing: false },
      { name: 'Mei', value: '05', from: '2025-05-01', to: '2025-05-31', synced: false, syncing: false },
      { name: 'Juni', value: '06', from: '2025-06-01', to: '2025-06-30', synced: false, syncing: false },
      { name: 'Juli', value: '07', from: '2025-07-01', to: '2025-07-31', synced: false, syncing: false },
      { name: 'Agustus', value: '08', from: '2025-08-01', to: '2025-08-31', synced: false, syncing: false },
      { name: 'September', value: '09', from: '2025-09-01', to: '2025-09-30', synced: false, syncing: false },
      { name: 'Oktober', value: '10', from: '2025-10-01', to: '2025-10-31', synced: false, syncing: false },
      { name: 'November', value: '11', from: '2025-11-01', to: '2025-11-29', synced: false, syncing: false }
    ])

    const selectedBranchData = computed(() => {
      return props.branches.find(b => b.id === selectedBranch.value)
    })

    const onBranchChange = () => {
      checkResult.value = null
      syncResult.value = null
      error.value = ''
    }

    const reloadBranches = async () => {
      reloading.value = true
      error.value = ''
      
      try {
        const result = await apiService.reloadBranches()
        if (result.success) {
          // Update branches prop (emit to parent)
          // For now, just reload the page or manually update
          window.location.reload()
        } else {
          error.value = result.error || 'Failed to reload branches'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        reloading.value = false
      }
    }

    const checkSync = async () => {
      if (!selectedBranch.value) {
        error.value = 'Pilih cabang terlebih dahulu'
        return
      }

      checking.value = true
      error.value = ''
      checkResult.value = null
      syncResult.value = null

      try {
        const result = await apiService.checkSyncStatus({
          branchId: selectedBranch.value,
          dateFrom: dateFrom.value,
          dateTo: dateTo.value,
          dateFilterType: dateFilterType.value
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
      syncStatus.value = mode === 'missing' ? 'Syncing missing invoices...' : 'Re-syncing all invoices...'

      try {
        console.log('🚀 Starting sync...', { mode, branchId: selectedBranch.value, dateFrom: dateFrom.value, dateTo: dateTo.value })
        
        // Simulate progress
        const progressInterval = setInterval(() => {
          if (syncProgress.value < 90) {
            syncProgress.value += 5
            syncStatus.value = `Syncing... ${syncProgress.value}%`
          }
        }, 1000)

        const result = await apiService.syncSmart({
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
          // Refresh check result after sync
          await checkSync()
        } else {
          console.error('❌ Sync failed:', result.error)
          error.value = result.error || 'Failed to sync invoices'
        }
      } catch (err) {
        console.error('❌ Sync error:', err)
        error.value = err.message
      } finally {
        syncing.value = false
      }
    }

    const syncByMonth = () => {
      showMonthlyHelper.value = !showMonthlyHelper.value
    }

    const syncMonth = async (month) => {
      if (!selectedBranch.value) {
        error.value = 'Pilih cabang terlebih dahulu'
        return
      }

      month.syncing = true
      syncing.value = true
      error.value = ''

      try {
        const result = await apiService.syncInvoices({
          branchId: selectedBranch.value,
          dateFrom: month.from,
          dateTo: month.to,
          dateFilterType: dateFilterType.value,
          batchSize: batchSize.value,
          batchDelay: batchDelay.value,
          streamInsert: streamInsert.value
        })

        if (result.success) {
          month.synced = true
          syncResult.value = result
        } else {
          error.value = `Failed to sync ${month.name}: ${result.error}`
        }
      } catch (err) {
        error.value = `Error syncing ${month.name}: ${err.message}`
      } finally {
        month.syncing = false
        syncing.value = false
      }
    }

    const syncAllMonths = async () => {
      for (const month of monthList.value) {
        if (!month.synced) {
          await syncMonth(month)
          // Wait 2 seconds between months
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }

    const checkRelationsStatus = async () => {
      if (!selectedBranch.value) {
        error.value = 'Pilih cabang terlebih dahulu'
        return
      }

      checkingRelations.value = true
      error.value = ''
      checkRelationsResult.value = null

      try {
        const params = new URLSearchParams({
          branchId: selectedBranch.value,
          dateFrom: dateFrom.value,
          dateTo: dateTo.value
        })

        const response = await fetch(`/api/sales-invoices/check-relations-status?${params}`)
        const data = await response.json()

        if (response.ok && data.success) {
          checkRelationsResult.value = data
        } else {
          error.value = `❌ ${data.error || 'Failed to check relations status'}`
        }
      } catch (err) {
        error.value = `❌ Error: ${err.message}`
        console.error('Check relations error:', err)
      } finally {
        checkingRelations.value = false
      }
    }

    const extractRelations = async () => {
      if (!selectedBranch.value) {
        error.value = 'Pilih cabang terlebih dahulu'
        return
      }

      extracting.value = true
      extractStatus.value = 'Memproses...'
      error.value = ''
      extractResult.value = null

      try {
        const params = new URLSearchParams({
          branchId: selectedBranch.value,
          dateFrom: dateFrom.value,
          dateTo: dateTo.value
        })

        const response = await fetch(`/api/sales-invoices/extract-relations?${params}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        })

        const data = await response.json()

        if (response.ok && data.success) {
          extractResult.value = data
          extractStatus.value = `✅ ${data.message}`
          // Refresh check relations status
          await checkRelationsStatus()
        } else {
          error.value = `❌ ${data.error || 'Failed to extract relations'}`
        }
      } catch (err) {
        error.value = `❌ Error: ${err.message}`
        console.error('Extract error:', err)
      } finally {
        extracting.value = false
      }
    }

    return {
      selectedBranch,
      dateFrom,
      dateTo,
      dateFilterType,
      batchSize,
      batchDelay,
      streamInsert,
      checking,
      syncing,
      reloading,
      extracting,
      checkingRelations,
      checkResult,
      syncResult,
      extractResult,
      checkRelationsResult,
      syncProgress,
      syncStatus,
      extractStatus,
      error,
      showMonthlyHelper,
      monthList,
      selectedBranchData,
      onBranchChange,
      reloadBranches,
      checkSync,
      syncSmartMissing,
      syncSmartAll,
      syncSmart,
      syncByMonth,
      syncMonth,
      syncAllMonths,
      checkRelationsStatus,
      extractRelations
    }
  }
}
</script>

<style scoped>
.sync-manager {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.card h3 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 18px;
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
  flex-wrap: wrap;
}

.branch-selector .select-input {
  flex: 1;
  min-width: 200px;
}

.branch-selector .btn {
  flex-shrink: 0;
  padding: 8px 16px;
}

.select-input, .date-input, .number-input {
  width: 100%;
  padding: 8px 12px;
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
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
   font-size: 14px;
  transition: all 0.2s;
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

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background: #138496;
}

.btn-warning {
  background: #ffc107;
  color: #333;
  width: 100%;
  margin-top: 16px;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #5a6268;
}

.button-group {
  display: flex;
  gap: 12px;
}

.button-group .btn {
  flex: 1;
}

.result-box {
  margin-top: 16px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 4px solid #42b983;
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
  height: 8px;
  background: #dee2e6;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 8px;
  text-align: center;
  color: #666;
  font-size: 14px;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.month-btn {
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.month-btn:hover:not(:disabled) {
  border-color: #42b983;
  background: #f0fdf4;
}

.month-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.month-btn.synced {
  border-color: #28a745;
  background: #d4edda;
}

.month-btn.syncing {
  border-color: #ffc107;
  background: #fff3cd;
}

.month-name {
  font-weight: 500;
  font-size: 14px;
}

.status {
  font-size: 18px;
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
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 4px;
  background: white;
  border: 1px solid #e9ecef;
}

.status-card.new {
  border-color: #28a745;
  background: #f1f8f4;
}

.status-card.updated {
  border-color: #ffc107;
  background: #fff8f0;
}

.status-card.unchanged {
  border-color: #6c757d;
  background: #f0f7ff;
}

.status-card.total {
  border-color: #007bff;
  background: #f8f0ff;
}

.status-icon {
  font-size: 24px;
  margin-right: 8px;
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
  font-size: 18px;
  font-weight: bold;
  color: #333;
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

.invoice-list {
  margin-top: 16px;
}

.invoice-list h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #555;
}

.invoice-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.invoice-chip {
  display: inline-block;
  padding: 4px 10px;
  background: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 12px;
  font-size: 12px;
  color: #1976d2;
  font-weight: 500;
}

.more-chip {
  display: inline-block;
  padding: 4px 10px;
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 12px;
  font-size: 12px;
  color: #666;
  font-style: italic;
}
</style>
