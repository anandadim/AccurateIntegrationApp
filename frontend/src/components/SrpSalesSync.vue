<template>
  <div class="sync-manager">
    <h2>🧾 SRP Sales Detail Sync</h2>

    <div class="card">
      <div class="card-header">
        <h3>1. Konfigurasi Cabang</h3>
        <div class="branch-actions">
          <button class="btn btn-secondary" @click="fetchBranches(true)" :disabled="loadingBranches">
            {{ loadingBranches ? '⏳' : '🔄' }} Reload Konfigurasi
          </button>
          <button class="btn btn-outline" @click="fetchBranches(false)" :disabled="loadingBranches">
            {{ loadingBranches ? 'Loading...' : 'Refresh Daftar' }}
          </button>
        </div>
      </div>
      <p class="hint">Daftar cabang aktif yang akan otomatis diproses ketika sync.</p>
      <div v-if="branches.length" class="branch-list">
        <table>
          <thead>
            <tr>
              <th>Nama Cabang</th>
              <th>ID</th>
              <th>Location Code</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="branch in branches" :key="branch.id">
              <td>{{ branch.name }}</td>
              <td>{{ branch.id }}</td>
              <td>{{ branch.locationCode || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="empty-state">
        Tidak ada cabang aktif. Pastikan konfigurasi <code>srp-branches.json</code> atau ENV terset.
      </div>
    </div>

    <div class="card">
      <h3>2. Parameter Sync</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Store Code</label>
          <input v-model="storeCode" class="text-input" placeholder="All Stores" />
          <span class="sub-hint">Gunakan "All Stores" untuk semua cabang atau isi kode toko tertentu.</span>
        </div>
        <div class="form-group">
          <label>Tanggal Mulai</label>
          <input type="date" v-model="dateFrom" class="text-input" />
        </div>
        <div class="form-group">
          <label>Tanggal Selesai</label>
          <input type="date" v-model="dateTo" class="text-input" />
        </div>
        <div class="form-group">
          <label>Chunk Size (hari)</label>
          <input type="number" min="1" max="31" v-model.number="chunkSizeDays" class="number-input" />
        </div>
        <div class="form-group">
          <label>Delay antar chunk (ms)</label>
          <input type="number" min="0" step="50" v-model.number="delayMs" class="number-input" />
        </div>
        <div class="form-group checkbox">
          <label>
            <input type="checkbox" v-model="truncateBeforeInsert" />
            Truncate sebelum insert (snapshot)
          </label>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>3. Jalankan Sync</h3>
      
      <p class="hint">Proses sync akan memproses data berdasarkan parameter di atas untuk setiap cabang aktif.</p>
      
      <button class="btn btn-primary" @click="syncSalesDetail" :disabled="syncing || !branches.length">
        {{ syncing ? '⏳ Syncing...' : '🚀 Sync Sales Detail' }}
      </button>

      <div v-if="syncing" class="progress-box">
        <div class="progress-header">
          <span>{{ progressMessage }}</span>
          <span>{{ syncProgress }}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: syncProgress + '%' }"></div>
        </div>
      </div>

      <div v-if="syncResult" class="result-box success">
        <h4>✅ Sync Selesai</h4>
        <div class="result-grid">
          <div class="result-item">
            <span class="label">Total Fetched</span>
            <span class="value">{{ syncResult.totals.totalFetched }}</span>
          </div>
          <div class="result-item">
            <span class="label">Inserted</span>
            <span class="value success-text">{{ syncResult.totals.totalInserted }}</span>
          </div>
          <div class="result-item">
            <span class="label">Updated</span>
            <span class="value">{{ syncResult.totals.totalUpdated }}</span>
          </div>
          <div class="result-item">
            <span class="label">Range</span>
            <span class="value">
              {{ syncResult.totals.dateRange.from }} → {{ syncResult.totals.dateRange.to }}
            </span>
          </div>
          <div class="result-item">
            <span class="label">Store Code</span>
            <span class="value">{{ syncResult.totals.storeCode }}</span>
          </div>
          <div class="result-item">
            <span class="label">Chunk Count</span>
            <span class="value">{{ syncResult.totals.chunkCount }}</span>
          </div>
        </div>

        <div v-if="syncResult.totals.aggregatedTotals" class="totals-box">
          <h5>Ringkasan Nilai</h5>
          <div class="totals-grid">
            <div class="total-item">
              <span class="label">Gross Amount</span>
              <span class="value">{{ formatNumber(syncResult.totals.aggregatedTotals.total_gross_amount) }}</span>
            </div>
            <div class="total-item">
              <span class="label">Net Amount</span>
              <span class="value">{{ formatNumber(syncResult.totals.aggregatedTotals.total_net_amount) }}</span>
            </div>
            <div class="total-item">
              <span class="label">Net Sales</span>
              <span class="value">{{ formatNumber(syncResult.totals.aggregatedTotals.total_net_sales) }}</span>
            </div>
            <div class="total-item">
              <span class="label">Quantity</span>
              <span class="value">{{ formatNumber(syncResult.totals.aggregatedTotals.total_quantity) }}</span>
            </div>
            <div class="total-item">
              <span class="label">Margin</span>
              <span class="value">{{ formatNumber(syncResult.totals.aggregatedTotals.total_margin) }}</span>
            </div>
            <div class="total-item">
              <span class="label">Tax</span>
              <span class="value">{{ formatNumber(syncResult.totals.aggregatedTotals.total_tax) }}</span>
            </div>
          </div>
        </div>

        <div v-if="syncResult.chunks && syncResult.chunks.length" class="chunk-results">
          <h5>Rincian per Chunk</h5>
          <table>
            <thead>
              <tr>
                <th>Periode</th>
                <th>Fetched</th>
                <th>Inserted</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="chunk in syncResult.chunks" :key="chunk.dateFrom + chunk.dateTo">
                <td>{{ chunk.dateFrom }} → {{ chunk.dateTo }}</td>
                <td>{{ chunk.fetched }}</td>
                <td class="success-text">{{ chunk.saveSummary.insertedCount }}</td>
                <td>{{ chunk.saveSummary.updatedCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-box">❌ {{ error }}</div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue'
import apiService from '../services/apiService'

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultRange = () => {
  const today = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(today.getDate() - 6)
  return {
    from: formatDate(sevenDaysAgo),
    to: formatDate(today),
  }
}

export default {
  name: 'SrpSalesSync',
  setup() {
    const branches = ref([])
    const loadingBranches = ref(false)
    const syncing = ref(false)
    const syncProgress = ref(0)
    const progressMessage = ref('Menyiapkan sync...')
    const syncResult = ref(null)
    const error = ref('')

    const { from, to } = getDefaultRange()
    const storeCode = ref('All Stores')
    const dateFrom = ref(from)
    const dateTo = ref(to)
    const chunkSizeDays = ref(5)
    const delayMs = ref(200)
    const truncateBeforeInsert = ref(false)

    let progressInterval = null

    const clearProgressInterval = () => {
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
    }

    const startProgress = () => {
      clearProgressInterval()
      syncProgress.value = 0
      progressMessage.value = 'Menjalankan sync...'
      progressInterval = setInterval(() => {
        if (!syncing.value || syncProgress.value >= 90) {
          clearProgressInterval()
          return
        }
        syncProgress.value = Math.min(syncProgress.value + 5, 90)
        progressMessage.value = `Memproses ${syncProgress.value}%`
      }, 700)
    }

    const finishProgress = () => {
      clearProgressInterval()
      syncProgress.value = 100
      progressMessage.value = 'Selesai'
    }

    const fetchBranches = async (reload = false) => {
      loadingBranches.value = true
      error.value = ''
      try {
        const res = reload ? await apiService.reloadSrpBranches() : await apiService.getSrpBranches()
        if (res.success) {
          branches.value = res.data || []
          if (!branches.value.length) {
            error.value = 'Tidak ada cabang aktif di konfigurasi SNJ.'
          }
        } else {
          throw new Error(res.error || 'Gagal memuat cabang SNJ')
        }
      } catch (err) {
        error.value = err.message
      } finally {
        loadingBranches.value = false
      }
    }

    const formatNumber = (value) => {
      if (value === null || value === undefined) return '—'
      const number = Number(value)
      if (Number.isNaN(number)) return value
      return number.toLocaleString('id-ID', { maximumFractionDigits: 2 })
    }

    const validateInputs = () => {
      if (!storeCode.value) {
        throw new Error('Store code wajib diisi (gunakan "All Stores" bila ingin semua cabang)')
      }
      if (!dateFrom.value || !dateTo.value) {
        throw new Error('Tanggal mulai dan selesai wajib diisi')
      }
      if (new Date(dateFrom.value) > new Date(dateTo.value)) {
        throw new Error('Tanggal mulai tidak boleh lebih besar dari tanggal selesai')
      }
    }

    const syncSalesDetail = async () => {
      try {
        validateInputs()
      } catch (validationError) {
        error.value = validationError.message
        return
      }

      if (!branches.value.length) {
        error.value = 'Tidak ada cabang aktif untuk diproses.'
        return
      }

      syncing.value = true
      syncResult.value = null
      error.value = ''
      syncProgress.value = 0
      progressMessage.value = 'Menyiapkan sync...'
      startProgress()

      try {
        const payload = {
          storeCode: storeCode.value.trim(),
          dateFrom: dateFrom.value,
          dateTo: dateTo.value,
          chunkSizeDays: chunkSizeDays.value,
          delayMs: delayMs.value,
          truncateBeforeInsert: truncateBeforeInsert.value,
        }

        const res = await apiService.syncSrpSalesDetail(payload)
        finishProgress()

        if (res.success) {
          syncResult.value = res.data
        } else {
          throw new Error(res.message || res.error || 'Sync gagal')
        }
      } catch (err) {
        error.value = err.message
      } finally {
        syncing.value = false
      }
    }

    onMounted(() => {
      fetchBranches(false)
    })

    onUnmounted(() => {
      clearProgressInterval()
    })

    return {
      branches,
      loadingBranches,
      syncing,
      syncProgress,
      progressMessage,
      syncResult,
      error,
      storeCode,
      dateFrom,
      dateTo,
      chunkSizeDays,
      delayMs,
      truncateBeforeInsert,
      fetchBranches,
      syncSalesDetail,
      formatNumber,
    }
  },
}
</script>

<style scoped>
.sync-manager {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 24px;
  background: #f5f7fb;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(15, 20, 40, 0.08);
}

.sync-manager h2 {
  margin: 0 0 24px 0;
  font-size: 28px;
  font-weight: 700;
  color: #1e2a4a;
  letter-spacing: 0.3px;
}

.card {
  background: white;
  border-radius: 14px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 8px 18px rgba(15, 20, 40, 0.05);
  border: 1px solid rgba(30, 42, 74, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.card h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #243453;
}

.branch-actions {
  display: flex;
  gap: 12px;
}

.branch-list table,
.chunk-results table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.branch-list th,
.branch-list td,
.chunk-results th,
.chunk-results td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(36, 52, 83, 0.1);
  text-align: left;
  font-size: 14px;
  color: #2f3a5f;
}

.branch-list th,
.chunk-results th {
  font-weight: 600;
  color: #1e2a4a;
  background: rgba(91, 124, 250, 0.08);
}

.empty-state {
  padding: 16px;
  border-radius: 8px;
  background: #ffe8e8;
  color: #b84141;
  font-size: 14px;
}

.select-input,
.text-input,
.number-input,
textarea {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(36, 52, 83, 0.2);
  font-size: 14px;
  transition: border 0.2s ease;
  background: #fff;
}

.select-input:focus,
.text-input:focus,
.number-input:focus,
textarea:focus {
  outline: none;
  border-color: #5b7cfa;
  box-shadow: 0 0 0 3px rgba(91, 124, 250, 0.2);
}

textarea {
  min-height: 90px;
  resize: vertical;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group.checkbox {
  justify-content: flex-end;
}

.form-group label {
  font-weight: 500;
  color: #42526e;
}

.sub-hint {
  font-size: 12px;
  color: #7281a5;
}

.btn {
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-weight: 600;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #5b7cfa, #3a5bd9);
  color: white;
  box-shadow: 0 8px 16px rgba(91, 124, 250, 0.2);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(91, 124, 250, 0.25);
}

.btn-secondary {
  background: #e9ecfb;
  color: #25345c;
}

.btn-secondary:hover {
  background: #d8dcf5;
}

.btn-outline {
  background: white;
  border: 1px solid rgba(36, 52, 83, 0.2);
  color: #243453;
}

.btn-outline:hover {
  border-color: #5b7cfa;
  color: #5b7cfa;
}

.progress-box {
  margin-top: 16px;
  padding: 16px;
  background: rgba(91, 124, 250, 0.08);
  border-radius: 10px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #42526e;
  margin-bottom: 8px;
}

.progress-bar {
  position: relative;
  height: 10px;
  background: rgba(33, 45, 80, 0.1);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0;
  background: linear-gradient(135deg, #5b7cfa, #3a5bd9);
  transition: width 0.3s ease;
}

.result-box {
  margin-top: 18px;
  padding: 18px;
  border: 1px solid rgba(91, 124, 250, 0.25);
  border-radius: 12px;
  background: rgba(91, 124, 250, 0.08);
}

.result-box h4 {
  margin: 0 0 12px;
  color: #243453;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(36, 52, 83, 0.1);
}

.result-item .label {
  color: #42526e;
  font-weight: 500;
}

.result-item .value {
  color: #1e2a4a;
  font-weight: 600;
}

.success-text {
  color: #1aa66b;
}

.totals-box {
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(91, 124, 250, 0.2);
}

.totals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.total-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(36, 52, 83, 0.15);
}

.chunk-results {
  margin-top: 16px;
}

.chunk-results h5,
.totals-box h5 {
  margin: 0 0 8px;
  font-size: 15px;
  color: #1e2a4a;
}

.error-box {
  margin-top: 20px;
  padding: 16px;
  background: #ffe8e8;
  border: 1px solid #f5b2b2;
  color: #b84141;
  border-radius: 12px;
}

.hint {
  font-size: 12px;
  color: #6b7a99;
  margin-bottom: 8px;
}

@media (max-width: 720px) {
  .sync-manager {
    padding: 16px;
  }

  .card {
    padding: 18px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .branch-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
