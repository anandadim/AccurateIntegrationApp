<template>
  <div>
    <h1>🔗 Accurate Online API Integration</h1>
    
    <div class="view-toggle">
      <button 
        @click="currentView = 'invoice-sync'" 
        :class="{ active: currentView === 'invoice-sync' }"
      >
        📄 Sales Invoice Sync
      </button>
      <button 
        @click="currentView = 'purchase-invoice-sync'" 
        :class="{ active: currentView === 'purchase-invoice-sync' }"
      >
        📦 Purchase Invoice Sync
      </button>
      <button 
        @click="currentView = 'order-sync'" 
        :class="{ active: currentView === 'order-sync' }"
      >
        📦 Sales Order Sync
      </button>
      <button 
        @click="currentView = 'customer-sync'" 
        :class="{ active: currentView === 'customer-sync' }"
      >
        👥 Customer Sync
      </button>
      <button 
        @click="currentView = 'item-sync'" 
        :class="{ active: currentView === 'item-sync' }"
      >
        📦 Items Sync
      </button>
      <button 
        @click="currentView = 'api'" 
        :class="{ active: currentView === 'api' }"
      >
        🔌 API Testing
      </button>
    </div>

    <!-- Sales Invoice Sync View -->
    <SyncManager v-if="currentView === 'invoice-sync'" :branches="branches" />

    <!-- Purchase Invoice Sync View -->
    <PurchaseInvoiceSync v-if="currentView === 'purchase-invoice-sync'" :branches="branches" />

    <!-- Sales Order Sync View -->
    <SalesOrderSync v-if="currentView === 'order-sync'" :branches="branches" />

    <!-- Customer View -->
    <CustomerSync v-if="currentView === 'customer-sync'" :branches="branches" />

    <!-- Items View -->
    <ItemSync v-if="currentView === 'item-sync'" :branches="branches" />

    <!-- API Testing View -->
    <div v-if="currentView === 'api'">
      <div class="view-toggle" style="margin-top: 16px;">
        <button 
          @click="viewMode = 'simple'" 
          :class="{ active: viewMode === 'simple' }"
        >
          Simple View
        </button>
        <button 
          @click="viewMode = 'table'" 
          :class="{ active: viewMode === 'table' }"
        >
          Table View
        </button>
      </div>
    
    <div class="container">
      <h2>1. Pilih Cabang</h2>
      <button @click="loadBranches" :disabled="loading">
        {{ loading ? 'Loading...' : 'Load Branches' }}
      </button>
      
      <div v-if="branches.length > 0" style="margin-top: 12px;">
        <select v-model="selectedBranch" @change="onBranchChange">
          <option value="">-- Pilih Cabang --</option>
          <option v-for="branch in branches" :key="branch.id" :value="branch.id">
            {{ branch.name }}
          </option>
        </select>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
    </div>

    <div class="container" v-if="selectedBranch">
      <h2>2. Database Info</h2>
      <div class="info-box">
        <strong>Cabang:</strong> {{ selectedBranchName }}<br>
        <strong>Database ID:</strong> {{ selectedDbId }}
      </div>
    </div>

    <div class="container" v-if="selectedBranch">
      <h2>3. Fetch Data</h2>

      <div>
        <button @click="fetchData('customer/list')" :disabled="loading">
          Get Customers (List Only)
        </button>
        <button @click="fetchData('item/list')" :disabled="loading">
          Get Items (List Only)
        </button>
        <button @click="fetchData('sales-invoice/list')" :disabled="loading">
          Get Sales Invoices (List Only)
        </button>
      </div>

      <div style="margin-top: 16px; padding-top: 16px; border-top: 2px solid #eee;">
        <strong>Get List + Details:</strong>
        
        <div style="margin-top: 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div>
            <label style="font-size: 12px; color: #666;">From:</label>
            <input type="date" v-model="dateFrom" style="padding: 6px; margin-left: 4px;">
          </div>
          <div>
            <label style="font-size: 12px; color: #666;">To:</label>
            <input type="date" v-model="dateTo" style="padding: 6px; margin-left: 4px;">
          </div>
          <div>
            <label style="font-size: 12px; color: #666;">Max:</label>
            <input type="number" v-model="maxItems" min="1" max="100" style="width: 60px; padding: 6px; margin-left: 4px;">
          </div>
        </div>
        
        <div style="margin-top: 12px;">
          <button @click="fetchListWithDetails('sales-invoice')" :disabled="loading">
            📄 Sales Invoice (List + Details)
          </button>
          <button @click="fetchListWithDetails('customer')" :disabled="loading">
            👥 Customer (List + Details)
          </button>
          <button @click="fetchListWithDetails('item')" :disabled="loading">
            📦 Item (List + Details)
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">Fetching data...</div>
      <div v-if="successMessage" class="success">{{ successMessage }}</div>
    </div>

    <div class="container" v-if="responseData">
      <h2>4. Response Data</h2>
      
      <!-- Table View for Sales Invoice -->
      <SalesInvoiceTable 
        v-if="viewMode === 'table' && responseData.items"
        :items="responseData.items"
        :summary="responseData.summary"
        :loading="loading"
      />
      
      <!-- Simple JSON View -->
      <pre v-else>{{ JSON.stringify(responseData, null, 2) }}</pre>
    </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import apiService from './services/apiService'
import SalesInvoiceTable from './components/SalesInvoiceTable.vue'
import PurchaseInvoiceTable from './components/PurchaseInvoiceTable.vue'
import SyncManager from './components/SyncManager.vue'
import PurchaseInvoiceSync from './components/PurchaseInvoiceSync.vue'
import SalesOrderSync from './components/SalesOrderSync.vue'
import ItemTable from './components/ItemTable.vue'
import ItemSync from './components/ItemSync.vue'
import CustomerSync from './components/CustomerSync.vue'

export default {
  name: 'App',
  components: {
    CustomerSync,
    SalesInvoiceTable,
    PurchaseInvoiceTable,
    SyncManager,
    PurchaseInvoiceSync,
    SalesOrderSync,
    ItemSync
  },
  setup() {
    const currentView = ref('invoice-sync')
    const branches = ref([])
    const selectedBranch = ref('')
    const selectedDbId = ref('')
    const responseData = ref(null)
    const loading = ref(false)
    const error = ref('')
    const successMessage = ref('')
    const maxItems = ref(20)
    const viewMode = ref('table')
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0]
    const dateFrom = ref(today)
    const dateTo = ref(today)

    const selectedBranchName = computed(() => {
      const branch = branches.value.find(b => b.id === selectedBranch.value)
      return branch ? branch.name : ''
    })

    const loadBranches = async () => {
      loading.value = true
      error.value = ''
      try {
        const result = await apiService.getBranches()
        if (result.success) {
          branches.value = result.data || []
          successMessage.value = `Loaded ${branches.value.length} branches`
          setTimeout(() => successMessage.value = '', 3000)
        } else {
          error.value = result.error || 'Failed to load branches'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    // Auto-load branches on mount
    onMounted(() => {
      loadBranches()
    })

    const onBranchChange = () => {
      const branch = branches.value.find(b => b.id === selectedBranch.value)
      if (branch) {
        selectedDbId.value = branch.dbId
      }
      responseData.value = null
      error.value = ''
    }

    const fetchData = async (endpoint) => {
      if (!selectedBranch.value) {
        error.value = 'Please select a branch first'
        return
      }

      loading.value = true
      error.value = ''
      responseData.value = null

      try {
        const result = await apiService.getData(endpoint, selectedDbId.value, selectedBranch.value)
        if (result.success) {
          responseData.value = result.data
          successMessage.value = `Data fetched successfully from ${endpoint}`
          setTimeout(() => successMessage.value = '', 3000)
        } else {
          error.value = result.error || 'Failed to fetch data'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    const fetchListWithDetails = async (endpoint) => {
      if (!selectedBranch.value) {
        error.value = 'Please select a branch first'
        return
      }

      loading.value = true
      error.value = ''
      responseData.value = null

      try {
        const options = {
          maxItems: maxItems.value,
          dateFrom: dateFrom.value,
          dateTo: dateTo.value,
          branchId: selectedBranch.value
        }
        
        const result = await apiService.getListWithDetails(endpoint, selectedDbId.value, options)
        if (result.success) {
          responseData.value = result.data
          successMessage.value = `Fetched ${result.data.items.length} ${endpoint} with details (${dateFrom.value} to ${dateTo.value})`
          setTimeout(() => successMessage.value = '', 3000)
        } else {
          error.value = result.error || 'Failed to fetch data'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    return {
      currentView,
      branches,
      selectedBranch,
      selectedBranchName,
      selectedDbId,
      responseData,
      loading,
      error,
      successMessage,
      maxItems,
      viewMode,
      dateFrom,
      dateTo,
      loadBranches,
      onBranchChange,
      fetchData,
      fetchListWithDetails
    }
  }
}
</script>
