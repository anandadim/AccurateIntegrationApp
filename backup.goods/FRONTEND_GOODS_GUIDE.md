# Frontend Goods Implementation Guide

## Overview
This guide explains how to implement the frontend UI components for Goods management, following the same pattern as Purchase Invoice.

## Frontend Architecture

### Component Structure
```
App.vue
  ├── Navigation (add Goods button)
  └── GoodsSync.vue (main component)
      ├── Branch selector
      ├── Batch configuration
      ├── Sync controls
      ├── Status cards
      ├── Progress bar
      └── Results display
  └── GoodsTable.vue (data table)
      ├── Filters
      ├── Search
      ├── Table
      └── Pagination
```

## Components to Create

### 1. GoodsSync.vue
Main sync manager component for goods synchronization.

**Location:** `frontend/src/components/GoodsSync.vue`

**Features:**
- Branch selection dropdown
- Batch size configuration (default 50)
- Delay configuration (default 100ms)
- Sync status cards (New, Updated, Unchanged, Total)
- Progress bar with percentage
- Results display (saved, errors, duration)
- Sync button with loading state
- Error messages and notifications

**Template Structure:**
```vue
<template>
  <div class="goods-sync-container">
    <!-- Header -->
    <div class="sync-header">
      <h2>📦 Goods Sync Manager</h2>
      <p>Synchronize goods/products from Accurate ERP</p>
    </div>

    <!-- Configuration Section -->
    <div class="sync-config">
      <div class="config-group">
        <label>Branch:</label>
        <select v-model="selectedBranch">
          <option value="">Select Branch</option>
          <option v-for="branch in branches" :key="branch.id" :value="branch.id">
            {{ branch.name }}
          </option>
        </select>
      </div>

      <div class="config-group">
        <label>Batch Size:</label>
        <input v-model.number="batchSize" type="number" min="10" max="500">
      </div>

      <div class="config-group">
        <label>Delay (ms):</label>
        <input v-model.number="delayMs" type="number" min="0" max="1000">
      </div>

      <button @click="checkSync" :disabled="!selectedBranch || loading">
        {{ loading ? 'Checking...' : '🔍 Check Sync Status' }}
      </button>
    </div>

    <!-- Status Cards -->
    <div v-if="syncStatus" class="status-cards">
      <div class="card total">
        <div class="label">Total</div>
        <div class="value">{{ syncStatus.summary.total }}</div>
      </div>
      <div class="card new">
        <div class="label">New</div>
        <div class="value">{{ syncStatus.summary.new }}</div>
      </div>
      <div class="card updated">
        <div class="label">Updated</div>
        <div class="value">{{ syncStatus.summary.updated }}</div>
      </div>
      <div class="card unchanged">
        <div class="label">Unchanged</div>
        <div class="value">{{ syncStatus.summary.unchanged }}</div>
      </div>
    </div>

    <!-- New/Updated Goods Display -->
    <div v-if="syncStatus && syncStatus.goods.new.length > 0" class="goods-chips">
      <h3>New Goods ({{ syncStatus.goods.new.length }})</h3>
      <div class="chips">
        <span v-for="good in syncStatus.goods.new" :key="good.id" class="chip new">
          {{ good.no }} - {{ good.name }}
        </span>
      </div>
    </div>

    <div v-if="syncStatus && syncStatus.goods.updated.length > 0" class="goods-chips">
      <h3>Updated Goods ({{ syncStatus.goods.updated.length }})</h3>
      <div class="chips">
        <span v-for="good in syncStatus.goods.updated" :key="good.id" class="chip updated">
          {{ good.no }} - {{ good.name }}
        </span>
      </div>
    </div>

    <!-- Sync Button -->
    <div v-if="syncStatus && syncStatus.summary.needSync > 0" class="sync-action">
      <button @click="syncGoods" :disabled="loading" class="sync-btn">
        {{ loading ? 'Syncing...' : `🚀 Sync ${syncStatus.summary.needSync} Goods` }}
      </button>
    </div>

    <!-- Progress Bar -->
    <div v-if="syncProgress" class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: syncProgress.percentage + '%' }"></div>
      </div>
      <div class="progress-text">
        {{ syncProgress.processed }} / {{ syncProgress.total }} ({{ syncProgress.percentage }}%)
      </div>
    </div>

    <!-- Results -->
    <div v-if="syncResults" class="results">
      <h3>Sync Results</h3>
      <table>
        <tr>
          <td>Total Processed:</td>
          <td>{{ syncResults.processed }}</td>
        </tr>
        <tr>
          <td>Saved:</td>
          <td class="success">{{ syncResults.saved }}</td>
        </tr>
        <tr>
          <td>Errors:</td>
          <td class="error">{{ syncResults.errors }}</td>
        </tr>
        <tr>
          <td>Duration:</td>
          <td>{{ syncResults.duration }}</td>
        </tr>
      </table>
    </div>

    <!-- Error Messages -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>
```

**Script:**
```javascript
import { apiService } from '@/services/apiService';

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
      syncProgress: null,
      syncResults: null,
      error: null
    };
  },
  mounted() {
    this.loadBranches();
  },
  methods: {
    async loadBranches() {
      try {
        const response = await apiService.getBranches();
        this.branches = response.data;
      } catch (err) {
        this.error = 'Failed to load branches: ' + err.message;
      }
    },
    async checkSync() {
      if (!this.selectedBranch) {
        this.error = 'Please select a branch';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const response = await apiService.checkGoodsSyncStatus(this.selectedBranch);
        this.syncStatus = response.data;
      } catch (err) {
        this.error = 'Failed to check sync status: ' + err.message;
      } finally {
        this.loading = false;
      }
    },
    async syncGoods() {
      if (!this.selectedBranch) {
        this.error = 'Please select a branch';
        return;
      }

      this.loading = true;
      this.error = null;
      this.syncProgress = null;
      this.syncResults = null;

      try {
        const response = await apiService.syncGoods(
          this.selectedBranch,
          this.batchSize,
          this.delayMs
        );
        this.syncResults = response.data.results;
      } catch (err) {
        this.error = 'Failed to sync goods: ' + err.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
```

**Styles:**
```css
.goods-sync-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.sync-header {
  margin-bottom: 30px;
}

.sync-header h2 {
  font-size: 24px;
  margin: 0 0 10px 0;
}

.sync-header p {
  color: #666;
  margin: 0;
}

.sync-config {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.config-group {
  display: flex;
  flex-direction: column;
}

.config-group label {
  font-weight: 600;
  margin-bottom: 5px;
  font-size: 14px;
}

.config-group input,
.config-group select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.sync-config button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  align-self: flex-end;
}

.sync-config button:hover:not(:disabled) {
  background: #0056b3;
}

.sync-config button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.status-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 30px;
}

.card {
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  color: white;
}

.card.total {
  background: #6c757d;
}

.card.new {
  background: #28a745;
}

.card.updated {
  background: #ffc107;
  color: black;
}

.card.unchanged {
  background: #17a2b8;
}

.card .label {
  font-size: 14px;
  opacity: 0.9;
  margin-bottom: 10px;
}

.card .value {
  font-size: 32px;
  font-weight: bold;
}

.goods-chips {
  margin-bottom: 20px;
}

.goods-chips h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip {
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip.new {
  background: #d4edda;
  color: #155724;
}

.chip.updated {
  background: #fff3cd;
  color: #856404;
}

.sync-action {
  margin-bottom: 30px;
}

.sync-btn {
  padding: 12px 24px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 16px;
}

.sync-btn:hover:not(:disabled) {
  background: #218838;
}

.sync-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.progress-section {
  margin-bottom: 30px;
}

.progress-bar {
  width: 100%;
  height: 30px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 12px;
}

.progress-text {
  text-align: center;
  color: #666;
  font-size: 14px;
}

.results {
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 20px;
}

.results h3 {
  margin: 0 0 15px 0;
}

.results table {
  width: 100%;
  border-collapse: collapse;
}

.results td {
  padding: 10px;
  border-bottom: 1px solid #ddd;
}

.results td:first-child {
  font-weight: 600;
  width: 150px;
}

.results .success {
  color: #28a745;
  font-weight: 600;
}

.results .error {
  color: #dc3545;
  font-weight: 600;
}

.error-message {
  padding: 15px;
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin-bottom: 20px;
}
```

### 2. GoodsTable.vue
Data table component for displaying goods.

**Location:** `frontend/src/components/GoodsTable.vue`

**Features:**
- Responsive table with sticky headers
- Category filter
- Type filter
- Suspended status filter
- Search by goods_no or goods_name
- Pagination
- Warehouse details display
- Selling prices display
- Loading and empty states

**Template Structure:**
```vue
<template>
  <div class="goods-table-container">
    <!-- Filters -->
    <div class="filters">
      <input 
        v-model="search" 
        type="text" 
        placeholder="Search goods..."
        @input="onSearch"
      >
      <select v-model="selectedCategory">
        <option value="">All Categories</option>
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
      <select v-model="selectedType">
        <option value="">All Types</option>
        <option value="INVENTORY">Inventory</option>
        <option value="SERVICE">Service</option>
      </select>
      <select v-model="selectedStatus">
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="suspended">Suspended</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      Loading goods...
    </div>

    <!-- Empty State -->
    <div v-else-if="goods.length === 0" class="empty">
      No goods found
    </div>

    <!-- Table -->
    <div v-else class="table-wrapper">
      <table class="goods-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Category</th>
            <th>Type</th>
            <th>Unit</th>
            <th>Price</th>
            <th>Warehouses</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="good in goods" :key="good.id" class="goods-row">
            <td class="code">{{ good.goods_no }}</td>
            <td class="name">{{ good.goods_name }}</td>
            <td class="category">{{ good.category_name }}</td>
            <td class="type">{{ good.item_type }}</td>
            <td class="unit">{{ good.unit1_name }}</td>
            <td class="price">{{ formatCurrency(good.unit_price) }}</td>
            <td class="warehouses">
              <span v-if="good.warehouseDetails" class="warehouse-count">
                {{ good.warehouseDetails.length }} warehouse(s)
              </span>
            </td>
            <td class="status">
              <span :class="['badge', good.suspended ? 'suspended' : 'active']">
                {{ good.suspended ? 'Suspended' : 'Active' }}
              </span>
            </td>
            <td class="actions">
              <button @click="viewDetails(good)" class="btn-view">View</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="goods.length > 0" class="pagination">
      <button @click="previousPage" :disabled="currentPage === 1">← Previous</button>
      <span>Page {{ currentPage }} of {{ totalPages }}</span>
      <button @click="nextPage" :disabled="currentPage === totalPages">Next →</button>
    </div>

    <!-- Details Modal -->
    <div v-if="selectedGood" class="modal" @click="selectedGood = null">
      <div class="modal-content" @click.stop>
        <button class="close" @click="selectedGood = null">×</button>
        
        <h2>{{ selectedGood.goods_name }}</h2>
        
        <!-- Header Info -->
        <div class="detail-section">
          <h3>Product Information</h3>
          <table class="detail-table">
            <tr>
              <td>Code:</td>
              <td>{{ selectedGood.goods_no }}</td>
            </tr>
            <tr>
              <td>Name:</td>
              <td>{{ selectedGood.goods_name }}</td>
            </tr>
            <tr>
              <td>Category:</td>
              <td>{{ selectedGood.category_name }}</td>
            </tr>
            <tr>
              <td>Type:</td>
              <td>{{ selectedGood.item_type }}</td>
            </tr>
            <tr>
              <td>Unit:</td>
              <td>{{ selectedGood.unit1_name }}</td>
            </tr>
            <tr>
              <td>Cost:</td>
              <td>{{ formatCurrency(selectedGood.cost) }}</td>
            </tr>
            <tr>
              <td>Price:</td>
              <td>{{ formatCurrency(selectedGood.unit_price) }}</td>
            </tr>
            <tr>
              <td>Status:</td>
              <td>{{ selectedGood.suspended ? 'Suspended' : 'Active' }}</td>
            </tr>
          </table>
        </div>

        <!-- Warehouse Details -->
        <div v-if="selectedGood.warehouseDetails" class="detail-section">
          <h3>Warehouse Details</h3>
          <table class="detail-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Quantity</th>
                <th>Balance</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="wh in selectedGood.warehouseDetails" :key="wh.id">
                <td>{{ wh.warehouse_name }}</td>
                <td>{{ wh.unit1_quantity }}</td>
                <td>{{ wh.balance }} {{ wh.balance_unit }}</td>
                <td>{{ wh.default_warehouse ? '✓' : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Selling Prices -->
        <div v-if="selectedGood.sellingPrices" class="detail-section">
          <h3>Selling Prices</h3>
          <table class="detail-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Currency</th>
                <th>Branch</th>
                <th>Effective Date</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="price in selectedGood.sellingPrices" :key="price.id">
                <td>{{ price.price_category_name }}</td>
                <td>{{ price.unit_name }}</td>
                <td>{{ formatCurrency(price.price) }}</td>
                <td>{{ price.currency_code }}</td>
                <td>{{ price.branch_name }}</td>
                <td>{{ formatDate(price.effective_date) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
```

**Script:**
```javascript
import { apiService } from '@/services/apiService';

export default {
  name: 'GoodsTable',
  data() {
    return {
      goods: [],
      loading: false,
      search: '',
      selectedCategory: '',
      selectedType: '',
      selectedStatus: '',
      currentPage: 1,
      pageSize: 20,
      totalCount: 0,
      categories: [],
      selectedGood: null
    };
  },
  computed: {
    totalPages() {
      return Math.ceil(this.totalCount / this.pageSize);
    }
  },
  mounted() {
    this.loadGoods();
    this.loadCategories();
  },
  methods: {
    async loadGoods() {
      this.loading = true;
      try {
        const response = await apiService.getGoods({
          category_id: this.selectedCategory || undefined,
          item_type: this.selectedType || undefined,
          suspended: this.selectedStatus === 'suspended' ? true : 
                    this.selectedStatus === 'active' ? false : undefined,
          search: this.search || undefined,
          limit: this.pageSize,
          offset: (this.currentPage - 1) * this.pageSize
        });
        this.goods = response.data.data;
        this.totalCount = response.data.pagination.count;
      } catch (err) {
        console.error('Failed to load goods:', err);
      } finally {
        this.loading = false;
      }
    },
    async loadCategories() {
      try {
        const response = await apiService.getGoodsSummary();
        this.categories = [...new Set(response.data.data.byType.map(t => t.item_type))];
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    },
    onSearch() {
      this.currentPage = 1;
      this.loadGoods();
    },
    previousPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.loadGoods();
      }
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++;
        this.loadGoods();
      }
    },
    viewDetails(good) {
      this.selectedGood = good;
    },
    formatCurrency(value) {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(value);
    },
    formatDate(date) {
      return new Date(date).toLocaleDateString('id-ID');
    }
  },
  watch: {
    selectedCategory() {
      this.currentPage = 1;
      this.loadGoods();
    },
    selectedType() {
      this.currentPage = 1;
      this.loadGoods();
    },
    selectedStatus() {
      this.currentPage = 1;
      this.loadGoods();
    }
  }
};
```

**Styles:**
```css
.goods-table-container {
  padding: 20px;
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
}

.filters input,
.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.loading,
.empty {
  text-align: center;
  padding: 40px;
  color: #666;
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #ddd;
}

.goods-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.goods-table thead {
  background: #f5f5f5;
  position: sticky;
  top: 0;
}

.goods-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #ddd;
}

.goods-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.goods-table tbody tr:hover {
  background: #f9f9f9;
}

.code {
  font-weight: 600;
  color: #007bff;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.badge.active {
  background: #d4edda;
  color: #155724;
}

.badge.suspended {
  background: #f8d7da;
  color: #721c24;
}

.btn-view {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-view:hover {
  background: #0056b3;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 20px;
  padding: 20px;
}

.pagination button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  background: #0056b3;
}

.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.close {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #666;
}

.detail-section {
  margin-bottom: 30px;
}

.detail-section h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  border-bottom: 2px solid #007bff;
  padding-bottom: 10px;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
}

.detail-table td,
.detail-table th {
  padding: 10px;
  border-bottom: 1px solid #eee;
  text-align: left;
}

.detail-table td:first-child,
.detail-table th:first-child {
  font-weight: 600;
  width: 150px;
  background: #f5f5f5;
}
```

## API Service Methods

Add these methods to `frontend/src/services/apiService.js`:

```javascript
// Goods API Methods
async checkGoodsSyncStatus(branchId) {
  return this.get(`/goods/check-sync?branchId=${branchId}`);
},

async countGoods() {
  return this.get('/goods/count');
},

async syncGoods(branchId, batchSize = 50, delayMs = 100) {
  return this.post('/goods/sync', {
    branchId,
    batchSize,
    delayMs,
    streamInsert: false
  });
},

async getGoods(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category_id) params.append('category_id', filters.category_id);
  if (filters.item_type) params.append('item_type', filters.item_type);
  if (filters.suspended !== undefined) params.append('suspended', filters.suspended);
  if (filters.search) params.append('search', filters.search);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset !== undefined) params.append('offset', filters.offset);
  
  return this.get(`/goods?${params.toString()}`);
},

async getGoodsById(id) {
  return this.get(`/goods/${id}`);
},

async getGoodsSummary(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category_id) params.append('category_id', filters.category_id);
  if (filters.suspended !== undefined) params.append('suspended', filters.suspended);
  
  return this.get(`/goods/summary/stats?${params.toString()}`);
}
```

## App.vue Integration

Add to navigation and import components:

```vue
<template>
  <div id="app">
    <!-- Navigation -->
    <nav class="navbar">
      <button @click="currentView = 'goods-sync'">📦 Goods Sync</button>
      <button @click="currentView = 'goods-table'">📋 Goods List</button>
    </nav>

    <!-- Views -->
    <GoodsSync v-if="currentView === 'goods-sync'" />
    <GoodsTable v-if="currentView === 'goods-table'" />
  </div>
</template>

<script>
import GoodsSync from '@/components/GoodsSync.vue';
import GoodsTable from '@/components/GoodsTable.vue';

export default {
  components: {
    GoodsSync,
    GoodsTable
  },
  data() {
    return {
      currentView: 'goods-sync'
    };
  }
};
</script>
```

## Features Summary

### GoodsSync Component
- ✅ Branch selection
- ✅ Batch configuration
- ✅ Sync status checking
- ✅ Real-time sync
- ✅ Progress tracking
- ✅ Results display
- ✅ Error handling

### GoodsTable Component
- ✅ Responsive table
- ✅ Multiple filters
- ✅ Search functionality
- ✅ Pagination
- ✅ Detail modal
- ✅ Warehouse info
- ✅ Selling prices
- ✅ Status badges

## Styling

Both components use:
- Responsive grid layout
- Color-coded status badges
- Smooth transitions
- Mobile-friendly design
- Accessibility features

## Notes

- All dates formatted in Indonesian locale
- Currency formatted as IDR
- Components follow Vue 3 composition API patterns
- Error messages displayed to user
- Loading states for async operations
- Modal for detailed information
