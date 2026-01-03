<template>
  <div class="sync-manager">
    <h2>📋 SRP Item Master Sync</h2>

    <div class="card">
      <h3>1. Parameter Sync</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>Per Page</label>
          <input type="number" min="10" max="200" step="10" v-model.number="syncFilters.perPage" class="number-input" />
        </div>
        <div class="form-group">
          <label>Max Pages (opsional)</label>
          <input type="number" min="1" v-model.number="syncFilters.maxPages" class="number-input" placeholder="Semua halaman" />
        </div>
        <div class="form-group">
          <label>Delay per Page (ms)</label>
          <input type="number" min="0" step="50" v-model.number="syncFilters.pageDelay" class="number-input" />
        </div>
        <div class="form-group checkbox">
          <label>
            <input type="checkbox" v-model="syncFilters.truncateBeforeInsert" />
            Truncate sebelum insert (snapshot)
          </label>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>2. Jalankan Sync</h3>
      <p class="hint">Pastikan semua pengaturan sudah benar sebelum menjalankan sync</p>
      <button class="btn btn-primary" @click="syncItemMaster" :disabled="syncing">
        {{ syncing ? '⏳ Syncing...' : '🚀 Sync Item Master' }}
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
        <h4>✅ Sync Berhasil</h4>
        <div class="result-grid simple">
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
        </div>
        <div class="result-meta" v-if="syncResult.pagination">
          <span>Halaman terkumpul: {{ syncResult.pagination.collectedPages }}</span>
          <span>Total estimasi: {{ syncResult.pagination.total }}</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>3. Data Item Master Tersimpan</h3>
        <div class="inline-actions">
          <button class="btn btn-outline" @click="resetListFilters">Reset</button>
          <button class="btn btn-secondary" @click="fetchItems">Refresh</button>
        </div>
      </div>

      <div class="filter-row">
        <input v-model="listFilters.search" class="text-input" placeholder="Cari article code / description" @keyup.enter="applyListFilters" />
        <input v-model="listFilters.entityCode" class="text-input" placeholder="Entity code" @keyup.enter="applyListFilters" />
        <input v-model="listFilters.articleCode" class="text-input" placeholder="Article code" @keyup.enter="applyListFilters" />
        <button class="btn btn-primary" @click="applyListFilters">Search</button>
      </div>

      <div class="list-summary">
        <span>Showing {{ pagination.from || 0 }}-{{ pagination.to || 0 }} of {{ pagination.total }} items</span>
        <div class="per-page">
          <label>Per page</label>
          <input type="number" min="5" max="200" step="5" v-model.number="listFilters.perPage" @change="changePerPage" class="number-input small" />
        </div>
      </div>

      <div class="item-master__table" v-if="!listLoading && items.length">
        <table>
          <thead>
            <tr>
              <th>Article Code</th>
              <th>Description</th>
              <th>Entity</th>
              <th>UoM</th>
              <th>Class</th>
              <th>Department</th>
              <th>Barcodes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.article_code }}</td>
              <td>{{ item.article_description || '—' }}</td>
              <td>{{ item.entity_code || '—' }}</td>
              <td>{{ item.base_unit_of_measure || '—' }}</td>
              <td>{{ item.class_name || item.product_class_name || '—' }}</td>
              <td>{{ item.department_name || '—' }}</td>
              <td>
                <span v-for="barcode in item.barcodes" :key="barcode.id || barcode.gtin_code" class="barcode">
                  {{ barcode.gtin_code || barcode.code }}
                  <em v-if="barcode.main_ean" class="main">(main)</em>
                </span>
                <span v-if="!item.barcodes || !item.barcodes.length">—</span>
              </td>
              <td>
                <span :class="['status', item.is_active ? 'active' : 'inactive']">
                  {{ item.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else-if="listLoading" class="item-master__loading">Loading...</div>
      <div v-else class="item-master__empty">Belum ada data item master tersimpan.</div>

      <div v-if="pagination.lastPage > 1" class="item-master__pagination">
        <button :disabled="pagination.page <= 1" @click="goToPage(pagination.page - 1)">
          Previous
        </button>
        <span>Page {{ pagination.page }} of {{ pagination.lastPage }}</span>
        <button :disabled="pagination.page >= pagination.lastPage" @click="goToPage(pagination.page + 1)">
          Next
        </button>
      </div>
    </div>

    <div v-if="error" class="error-box">❌ {{ error }}</div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import apiService from '../services/apiService'

export default {
  name: 'SrpItemMasterSync',
  setup() {
    const syncing = ref(false)
    const syncProgress = ref(0)
    const progressMessage = ref('Menyiapkan sync...')
    const syncResult = ref(null)
    const error = ref('')

    const syncFilters = reactive({
      perPage: 100,
      maxPages: null,
      pageDelay: 150,
      truncateBeforeInsert: false,
    })

    const items = ref([])
    const listLoading = ref(false)
    const listFilters = reactive({
      search: '',
      entityCode: '',
      articleCode: '',
      perPage: 25,
      page: 1,
    })
    const pagination = reactive({
      total: 0,
      perPage: 25,
      page: 1,
      lastPage: 1,
      from: 0,
      to: 0,
    })

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
        syncProgress.value += 5
        progressMessage.value = `Memproses ${syncProgress.value}%`
      }, 700)
    }

    const finishProgress = () => {
      clearProgressInterval()
      syncProgress.value = 100
      progressMessage.value = 'Selesai'
    }

    const buildSyncPayload = () => {
      const payload = {
        perPage: syncFilters.perPage,
        pageDelay: syncFilters.pageDelay,
        truncateBeforeInsert: syncFilters.truncateBeforeInsert,
      }
      if (syncFilters.maxPages) payload.maxPages = syncFilters.maxPages

      return payload
    }

    const syncItemMaster = async () => {
      syncing.value = true
      syncResult.value = null
      error.value = ''
      syncProgress.value = 0
      progressMessage.value = 'Menyiapkan sync...'
      startProgress()

      try {
        const res = await apiService.syncSrpItemMaster(buildSyncPayload())
        finishProgress()

        if (res.success) {
          syncResult.value = res.data
          await fetchItems()
        } else {
          throw new Error(res.message || res.error || 'Sync gagal')
        }
      } catch (err) {
        error.value = err.message
      } finally {
        syncing.value = false
      }
    }

    const fetchItems = async () => {
      listLoading.value = true
      error.value = ''
      try {
        const res = await apiService.getItemMasterRecords({
          search: listFilters.search || null,
          entityCode: listFilters.entityCode || null,
          articleCode: listFilters.articleCode || null,
          perPage: listFilters.perPage,
          page: listFilters.page,
        })

        if (res.success) {
          const data = res.data || {}
          items.value = data.items || []
          Object.assign(pagination, {
            total: data.pagination?.total || 0,
            perPage: data.pagination?.perPage || listFilters.perPage,
            page: data.pagination?.page || listFilters.page,
            lastPage: data.pagination?.lastPage || 1,
            from: data.pagination?.from || 0,
            to: data.pagination?.to || 0,
          })
        } else {
          throw new Error(res.message || 'Gagal memuat data item master')
        }
      } catch (err) {
        error.value = err.message
      } finally {
        listLoading.value = false
      }
    }

    const applyListFilters = () => {
      listFilters.page = 1
      fetchItems()
    }

    const resetListFilters = () => {
      Object.assign(listFilters, {
        search: '',
        entityCode: '',
        articleCode: '',
        perPage: 25,
        page: 1,
      })
      fetchItems()
    }

    const changePerPage = () => {
      if (listFilters.perPage < 5) listFilters.perPage = 5
      listFilters.page = 1
      fetchItems()
    }

    const goToPage = (page) => {
      if (page < 1 || page > pagination.lastPage) return
      listFilters.page = page
      fetchItems()
    }

    onMounted(() => {
      fetchItems()
    })

    onUnmounted(() => {
      clearProgressInterval()
    })

    return {
      syncing,
      syncProgress,
      progressMessage,
      syncResult,
      error,
      syncFilters,
      items,
      listFilters,
      pagination,
      listLoading,
      syncItemMaster,
      applyListFilters,
      resetListFilters,
      goToPage,
      changePerPage,
      fetchItems,
    }
  },
}
</script>

<style scoped>
.sync-manager {
  max-width: 1100px;
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
  flex-wrap: wrap;
}

.card h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #243453;
}

.branch-actions,
.inline-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.branch-list table,
.branch-results table,
.item-master__table table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.branch-list th,
.branch-list td,
.branch-results th,
.branch-results td,
.item-master__table th,
.item-master__table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(36, 52, 83, 0.1);
  text-align: left;
  font-size: 14px;
  color: #2f3a5f;
}

.branch-list th,
.branch-results th,
.item-master__table th {
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

.hint {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #5b6b95;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.filter-row .btn {
  align-self: stretch;
}

.list-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #4a5775;
}

.per-page {
  display: flex;
  align-items: center;
  gap: 8px;
}

.select-input,
.text-input,
.number-input,
.text-area {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid rgba(36, 52, 83, 0.2);
  font-size: 14px;
  transition: border 0.2s ease;
  background: #fff;
}

.number-input.small {
  width: 80px;
}

.select-input:focus,
.text-input:focus,
.number-input:focus,
.text-area:focus {
  outline: none;
  border-color: #5b7cfa;
  box-shadow: 0 0 0 3px rgba(91, 124, 250, 0.2);
}

.checkbox {
  display: flex;
  align-items: center;
}

.btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s ease, transform 0.1s ease;
}

.btn-primary {
  background: linear-gradient(135deg, #5b7cfa, #4053d6);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-1px);
  background: linear-gradient(135deg, #6d88fb, #4a5de0);
}

.btn-secondary {
  background: #dde4ff;
  color: #223175;
}

.btn-secondary:hover {
  background: #c8d3ff;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(36, 52, 83, 0.25);
  color: #2a3b62;
}

.btn-outline:hover {
  background: rgba(36, 52, 83, 0.06);
}

.item-master__loading,
.item-master__empty {
  text-align: center;
  padding: 24px;
  font-size: 15px;
  color: #2f3a5f;
}

.barcode {
  display: block;
  font-family: monospace;
  font-size: 12px;
}

.barcode .main {
  color: #28a745;
  font-weight: 600;
}

.status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status.active {
  background: #d4edda;
  color: #155724;
}

.status.inactive {
  background: #f8d7da;
  color: #721c24;
}

.item-master__pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  font-size: 14px;
}

.item-master__pagination button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.item-master__pagination button:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #007bff;
}

.item-master__pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress-box {
  margin-top: 16px;
  padding: 16px;
  border-radius: 10px;
  background: rgba(91, 124, 250, 0.08);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 8px;
  color: #2f3a5f;
}

.progress-bar {
  width: 100%;
  height: 10px;
  background: rgba(91, 124, 250, 0.2);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #5b7cfa;
  transition: width 0.2s ease;
}

.result-box {
  margin-top: 16px;
  padding: 18px;
  border-radius: 12px;
  background: #e7f6ef;
  color: #245b3d;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.result-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-item .label {
  font-size: 12px;
  color: #4a5775;
}

.result-item .value {
  font-size: 18px;
  font-weight: 700;
}

.success-text {
  color: #1e7e34;
}

.branch-results {
  margin-top: 18px;
}

.error-box {
  margin-top: 24px;
  padding: 16px;
  border-radius: 10px;
  background: #ffe4e4;
  color: #b02a37;
  border: 1px solid rgba(176, 42, 55, 0.3);
}

@media (max-width: 768px) {
  .sync-manager {
    padding: 16px;
  }

  .card {
    padding: 18px;
  }
}
</style>
