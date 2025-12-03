<template>
  <div class="customer-sync">
    <h2>👥 Customer Sync Manager</h2>

    <!-- Branch select -->
    <div class="card">
      <h3>1. Select Branch</h3>
      <select v-model="branchId" class="select-input" @change="reset">
        <option value="">-- Select Branch --</option>
        <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.name }}</option>
      </select>
    </div>

    <!-- Check sync -->
    <div class="card" v-if="branchId">
      <h3>2. Check Sync Status</h3>
      <button class="btn btn-primary" @click="checkSync" :disabled="checking">
        {{ checking ? 'Checking...' : '🔍 Check' }}
      </button>
      <div v-if="checkRes" class="mt-4">
        <p>Total: {{ checkRes.summary.total }} | New: {{ checkRes.summary.new }} | Updated: {{ checkRes.summary.updated }}</p>
        <p v-if="checkRes.summary.needSync">⚠ Need sync: {{ checkRes.summary.needSync }}</p>
        <p v-else>✅ Up to date</p>
      </div>
    </div>

    <!-- Sync -->
    <div class="card" v-if="branchId && checkRes">
      <h3>3. Sync</h3>
      <button class="btn btn-success" @click="sync('missing')" :disabled="syncing || checkRes.summary.needSync===0">
        {{ syncing ? 'Syncing...' : '⚡ Sync Missing' }}
      </button>
      <button class="btn btn-warning" @click="sync('all')" :disabled="syncing">
        {{ syncing ? 'Syncing...' : '🔄 Re-sync All' }}
      </button>
      <p v-if="syncRes" class="mt-2">Saved: {{ syncRes.saved }} , Errors: {{ syncRes.errors }}</p>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-box">{{ error }}</div>
  </div>
</template>

<script>
import { ref } from 'vue'
import apiService from '../services/apiService'

export default {
  name: 'CustomerSync',
  props: { branches: Array },
  setup(props) {
    const branchId = ref('')
    const checkRes = ref(null)
    const syncRes = ref(null)
    const checking = ref(false)
    const syncing = ref(false)
    const error = ref('')

    const reset = () => {
      checkRes.value = null
      syncRes.value = null
      error.value = ''
    }

    const checkSync = async () => {
      if(!branchId.value) return
      checking.value = true; error.value=''; checkRes.value=null
      try{
        const res = await apiService.checkCustomerSyncStatus({branchId: branchId.value})
        if(res.success) checkRes.value = res
        else error.value = res.error || 'Failed'
      }catch(e){ error.value=e.message }
      finally{ checking.value=false }
    }

    const sync = async (mode)=>{
      if(!branchId.value) return
      syncing.value=true; error.value=''; syncRes.value=null
      try{
        const res = await apiService.syncCustomersSmart({branchId: branchId.value, mode})
        if(res.success) { syncRes.value=res; await checkSync() }
        else error.value=res.error||'Failed'
      }catch(e){ error.value=e.message }
      finally{ syncing.value=false }
    }

    return {branchId, checkRes, syncRes, checking, syncing, error, reset, checkSync, sync}
  }
}
</script>

<style scoped>
.customer-sync{max-width:700px;margin:auto;padding:20px}
.card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.05)}
.btn{padding:8px 16px;border:none;border-radius:4px;color:#fff;cursor:pointer;margin-right:8px}
.btn-primary{background:#3b82f6}
.btn-success{background:#22c55e}
.btn-warning{background:#facc15;color:#000}
.select-input{padding:8px;border:1px solid #ddd;border-radius:4px;width:100%}
.error-box{background:#fee2e2;padding:12px;border:1px solid #fca5a5;border-radius:4px;color:#b91c1c}
</style>
