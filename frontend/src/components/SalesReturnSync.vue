<template>
  <div class="sync-manager">
    <h2>↩️ Sales Return Sync Manager</h2>

    <!-- 1. Branch selection -->
    <div class="card">
      <h3>1. Pilih Cabang</h3>
      <div class="branch-selector">
        <select v-model="selectedBranch" @change="onBranchChange" class="select-input">
          <option value="">-- Pilih Cabang --</option>
          <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
        <button @click="reloadBranches" :disabled="reloading" class="btn btn-secondary">
          {{ reloading ? '⏳' : '🔄' }} Reload
        </button>
      </div>
      <p class="hint">{{ branches.length }} cabang tersedia</p>
    </div>

    <!-- 2. Dry-run check -->
    <div class="card" v-if="selectedBranch">
      <h3>2. Cek Jumlah Return</h3>
      <div class="form-group"><label>Dari:</label><input type="date" v-model="dateFrom" class="date-input" /></div>
      <div class="form-group"><label>Sampai:</label><input type="date" v-model="dateTo" class="date-input" /></div>
      <div class="form-group"><label>Filter Type:</label>
        <select v-model="dateFilterType" class="select-input">
          <option value="createdDate">Created Date</option>
          <option value="transDate">Transaction Date</option>
        </select>
      </div>
      <button @click="checkSync" :disabled="checking" class="btn btn-primary">
        {{ checking ? '⏳ Checking...' : '🔍 Check Sync Status' }}
      </button>

      <!-- status -->
      <div v-if="checkResult" class="result-box">
        <h4>📊 Sync Status</h4>
        <div class="sync-status-grid">
          <div class="status-card new"><div class="status-icon">🆕</div><div class="status-content"><div class="status-label">New</div><div class="status-value">{{ checkResult.summary.new }}</div></div></div>
          <div class="status-card updated"><div class="status-icon">🔄</div><div class="status-content"><div class="status-label">Updated</div><div class="status-value">{{ checkResult.summary.updated }}</div></div></div>
          <div class="status-card unchanged"><div class="status-icon">✅</div><div class="status-content"><div class="status-label">Unchanged</div><div class="status-value">{{ checkResult.summary.unchanged }}</div></div></div>
          <div class="status-card total"><div class="status-icon">📊</div><div class="status-content"><div class="status-label">Total</div><div class="status-value">{{ checkResult.summary.total }}</div></div></div>
        </div>
        <div class="sync-recommendation">
          <p v-if="checkResult.summary.needSync>0" class="need-sync">⚠️ Need to sync <strong>{{ checkResult.summary.needSync }}</strong> returns</p>
          <p v-else class="up-to-date">✅ All data up-to-date</p>
        </div>
      </div>
    </div>

    <!-- 3. Sync -->
    <div class="card" v-if="selectedBranch">
      <h3>3. Sync Return</h3>
      <div class="form-group"><label>Batch Size</label><input type="number" v-model.number="batchSize" min="10" max="100" class="number-input"/></div>
      <div class="form-group"><label>Delay (ms)</label><input type="number" v-model.number="batchDelay" min="100" max="1000" step="100" class="number-input"/></div>
      <button @click="syncReturns" :disabled="syncing || !checkResult || checkResult.summary.needSync===0" class="btn btn-success">
        {{ syncing ? '⏳ Syncing...' : `⚡ Sync (${checkResult?.summary.needSync||0})` }}
      </button>

      <!-- progress -->
      <div v-if="syncing" class="progress-box"><div class="progress-header"><span>⏳ Syncing...</span><span>{{ syncProgress }}%</span></div><div class="progress-bar"><div class="progress-fill" :style="{width: syncProgress+'%'}"></div></div></div>
      <div v-if="syncResult" class="result-box success"><h4>✅ Sync Completed</h4><div class="result-grid"><div class="result-item"><span class="label">Saved:</span><span class="value success-text">{{ syncResult.summary.saved }}</span></div><div class="result-item"><span class="label">Errors:</span><span class="value error-text">{{ syncResult.summary.errors }}</span></div><div class="result-item"><span class="label">Duration:</span><span class="value">{{ syncResult.summary.duration }}</span></div></div></div>
    </div>

    <!-- error -->
    <div v-if="error" class="error-box">❌ {{ error }}</div>
  </div>
</template>

<script>
import { ref } from 'vue'
import apiService from '../services/apiService'
export default {
  name:'SalesReturnSync',
  props:{ branches:{type:Array,required:true} },
  setup(props){
    const selectedBranch=ref('')
    const today=new Date().toISOString().split('T')[0]
    const dateFrom=ref(today)
    const dateTo=ref(today)
    const dateFilterType=ref('createdDate')
    const batchSize=ref(20)
    const batchDelay=ref(500)
    const checking=ref(false)
    const syncing=ref(false)
    const reloading=ref(false)
    const checkResult=ref(null)
    const syncResult=ref(null)
    const syncProgress=ref(0)
    const error=ref('')

    const onBranchChange=()=>{checkResult.value=null;syncResult.value=null;error.value=''}

    const reloadBranches=async()=>{reloading.value=true;try{await apiService.reloadBranches();window.location.reload()}catch(e){error.value=e.message}finally{reloading.value=false}}

    const checkSync=async()=>{
      if(!selectedBranch.value){error.value='Pilih cabang';return}
      checking.value=true;error.value='';checkResult.value=null;try{
        const res=await apiService.checkReturnSyncStatus({branchId:selectedBranch.value,dateFrom:dateFrom.value,dateTo:dateTo.value,dateFilterType:dateFilterType.value});
        if(res.success) checkResult.value=res; else error.value=res.error||'Failed';
      }catch(e){error.value=e.message}finally{checking.value=false}
    }

    const syncReturns=async()=>{
      if(!selectedBranch.value){error.value='Pilih cabang';return}
      syncing.value=true;syncProgress.value=0;error.value='';syncResult.value=null;
      const int=setInterval(()=>{if(syncProgress.value<90) syncProgress.value+=5;},1000)
      try{
        const res=await apiService.syncReturns({branchId:selectedBranch.value,dateFrom:dateFrom.value,dateTo:dateTo.value,dateFilterType:dateFilterType.value,batchSize:batchSize.value,batchDelay:batchDelay.value});
        clearInterval(int);syncProgress.value=100;
        if(res.success){syncResult.value=res;await checkSync()} else error.value=res.error||'Sync failed';
      }catch(e){error.value=e.message}finally{syncing.value=false}
    }

    return{branches:props.branches,selectedBranch,dateFrom,dateTo,dateFilterType,batchSize,batchDelay,checking,syncing,reloading,checkResult,syncResult,syncProgress,error,onBranchChange,reloadBranches,checkSync,syncReturns}
  }
}
</script>

<style scoped>
/* Import styles from SalesReceiptSync */
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
  margin: 0 0 16px 0;
  color: #333;
  font-size: 18px;
}

.branch-selector {
  display: flex;
  gap: 12px;
  align-items: center;
}

.select-input, .date-input, .number-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover {
  background: #1e7e34;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: #555;
}

.result-box {
  margin-top: 20px;
  padding: 16px;
  border-radius: 4px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.result-box.success {
  background: #d4edda;
  border-color: #c3e6cb;
  color: #155724;
}

.result-box h4 {
  margin: 0 0 12px 0;
  color: #333;
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
  padding: 12px;
  border-radius: 4px;
  background: white;
  border: 1px solid #e9ecef;
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
}

.status-value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.status-card.new .status-value {
  color: #28a745;
}

.status-card.updated .status-value {
  color: #ffc107;
}

.status-card.unchanged .status-value {
  color: #6c757d;
}

.status-card.total .status-value {
  color: #007bff;
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

.progress-box {
  margin-top: 16px;
  padding: 16px;
  background: #e9ecef;
  border-radius: 4px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
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

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #e9ecef;
}

.result-item .label {
  font-weight: 500;
  color: #666;
}

.result-item .value {
  font-weight: bold;
  color: #333;
}

.success-text {
  color: #28a745;
}

.error-text {
  color: #dc3545;
}

.error-box {
  margin-top: 20px;
  padding: 16px;
  border-radius: 4px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  color: #721c24;
}

.hint {
  font-size: 12px;
  color: #666;
  margin: 8px 0 0 0;
}
</style>
