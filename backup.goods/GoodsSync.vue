<template>
  <div class="sync-manager">
    <h2>📦 Goods Sync Manager</h2>
    
    <!-- Branch Selection -->
    <div class="card">
      <h3>1. Pilih Cabang</h3>
      <div class="branch-selector">
        <select v-model="selectedBranch" class="select-input">
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
      <h3>2. Cek Status Sinkronisasi</h3>
      
      <button @click="checkSync" :disabled="loading" class="btn btn-primary">
        {{ loading ? '⏳ Checking...' : '🔍 Check Sync Status' }}
      </button>

      <!-- Check Sync Result -->
      <div v-if="syncStatus && syncStatus.summary" class="result-box">
        <h4>📊 Sync Status:</h4>
        
        <div class="sync-status-grid">
          <div class="status-card new">
            <div class="status-icon">🆕</div>
            <div class="status-content">
              <div class="status-label">New</div>
              <div class="status-value">{{ syncStatus.summary.new || 0 }}</div>
            </div>
          </div>
          
          <div class="status-card updated">
            <div class="status-icon">🔄</div>
            <div class="status-content">
              <div class="status-label">Updated</div>
              <div class="status-value">{{ syncStatus.summary.updated || 0 }}</div>
            </div>
          </div>
          
          <div class="status-card total">
            <div class="status-icon">📊</div>
            <div class="status-content">
              <div class="status-label">Total</div>
              <div class="status-value">{{ syncStatus.summary.total || 0 }}</div>
            </div>
          </div>
        </div>

        <div class="sync-recommendation">
          <p v-if="syncStatus.summary.needSync > 0" class="need-sync">
            ⚠️ Perlu disinkronkan: <strong>{{ syncStatus.summary.needSync }}</strong> barang
          </p>
          <p v-else class="up-to-date">
            ✅ Semua data sudah up-to-date! Tidak perlu sinkronisasi.
          </p>
        </div>
      </div>
    </div>

    <!-- Sync Actions -->
    <div class="card" v-if="selectedBranch && syncStatus">
      <h3>3. Sinkronisasi Barang</h3>
      
      <div class="form-group">
        <label>Batch Size:</label>
        <input type="number" v-model.number="batchSize" min="10" max="500" class="number-input">
        <span class="hint">Items per batch (10-500)</span>
      </div>

      <div class="form-group">
        <label>Batch Delay (ms):</label>
        <input type="number" v-model.number="delayMs" min="0" max="1000" step="100" class="number-input">
        <span class="hint">Delay antar batch</span>
      </div>

      <div class="button-group">
        <button 
          @click="syncGoods" 
          :disabled="loading || !syncStatus || !syncStatus.summary || syncStatus.summary.needSync === 0" 
          class="btn btn-success">
          {{ loading ? '⏳ Syncing...' : '🚀 Sync Goods' }}
        </button>
      </div>

      <!-- Sync Results -->
      <div v-if="syncResults" class="result-box">
        <h4>✅ Hasil Sinkronisasi:</h4>
        <div class="results-grid">
          <div class="result-item">
            <span class="result-label">Tersimpan:</span>
            <span class="result-value success">{{ syncResults.saved }}</span>
          </div>
          <div class="result-item">
            <span class="result-label">Error:</span>
            <span class="result-value error">{{ syncResults.errors }}</span>
          </div>
          <div class="result-item">
            <span class="result-label">Durasi:</span>
            <span class="result-value">{{ syncResults.duration }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="alert alert-error">
      {{ error }}
    </div>
  </div>
</template>

<script>
import apiService from '../services/apiService'

export default {
  name: 'GoodsSync',
  data() {
    return {
      branches: [],
      selectedBranch: '',
      batchSize: 50,
      delayMs: 100,
      loading: false,
      syncStatus: null,
      syncResults: null,
      error: null
    }
  },
  mounted() {
    this.loadBranches()
  },
  methods: {
    async loadBranches() {
      try {
        const response = await apiService.getBranches()
        this.branches = response.data || []
      } catch (err) {
        this.error = 'Failed to load branches: ' + err.message
      }
    },
    async checkSync() {
      console.log('checkSync called with branchId:', this.selectedBranch);
      if (!this.selectedBranch) {
        this.error = 'Please select a branch';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        console.log('Calling checkGoodsSyncStatus...');
        const response = await apiService.checkGoodsSyncStatus(this.selectedBranch);
        console.log('API Response:', response);
        // apiService.checkGoodsSyncStatus returns response directly (already response.data)
        this.syncStatus = response;
        console.log('Updated syncStatus:', this.syncStatus);
      } catch (error) {
        console.error('Error in checkSync:', error);
        this.error = 'Failed to check sync status: ' + (error.message || 'Unknown error');
      } finally {
        this.loading = false;
      }
    },
    async syncGoods() {
      if (!this.selectedBranch) {
        this.error = 'Please select a branch'
        return
      }

      this.loading = true
      this.error = null
      this.syncResults = null

      try {
        console.log('Calling syncGoods with:', {
          branchId: this.selectedBranch,
          batchSize: this.batchSize,
          delayMs: this.delayMs
        })
        const response = await apiService.syncGoods(
          this.selectedBranch,
          this.batchSize,
          this.delayMs
        )
        console.log('Sync response:', response)
        // apiService.syncGoods already returns response.data, so we access it directly
        this.syncResults = response.results || response
        console.log('Sync results:', this.syncResults)
      } catch (err) {
        console.error('Error in syncGoods:', err)
        this.error = 'Failed to sync goods: ' + (err.message || 'Unknown error')
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.sync-manager {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.sync-manager h2 {
  font-size: 28px;
  margin: 0 0 30px 0;
  color: #333;
}

.card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.card h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
  font-weight: 600;
}

.branch-selector {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.select-input,
.number-input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.select-input:focus,
.number-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0,123,255,0.25);
}

.hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #666;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 14px;
  color: #333;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
  margin-bottom: 20px;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.6;
}

.result-box {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 20px;
  margin-top: 20px;
}

.result-box h4 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.sync-status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.status-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  padding: 15px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.status-card.new {
  border-color: #28a745;
  background: #f1f8f4;
}

.status-card.updated {
  border-color: #ffc107;
  background: #fffbf0;
}

.status-card.total {
  border-color: #6c757d;
  background: #f8f9fa;
}

.status-icon {
  font-size: 24px;
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-size: 12px;
  color: #666;
  font-weight: 600;
  text-transform: uppercase;
}

.status-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.sync-recommendation {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
}

.sync-recommendation p {
  margin: 0;
  font-size: 14px;
}

.need-sync {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
  padding: 12px;
  border-radius: 4px;
}

.up-to-date {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  padding: 12px;
  border-radius: 4px;
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.result-item {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-label {
  font-weight: 600;
  color: #666;
  font-size: 13px;
}

.result-value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.result-value.success {
  color: #28a745;
}

.result-value.error {
  color: #dc3545;
}

.alert {
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
}

.alert-error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>