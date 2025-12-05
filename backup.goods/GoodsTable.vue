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
      <select v-model="selectedCategory" @change="onFilterChange">
        <option value="">All Categories</option>
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
      <select v-model="selectedType" @change="onFilterChange">
        <option value="">All Types</option>
        <option value="INVENTORY">Inventory</option>
        <option value="SERVICE">Service</option>
      </select>
      <select v-model="selectedStatus" @change="onFilterChange">
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
        <div v-if="selectedGood.warehouseDetails && selectedGood.warehouseDetails.length > 0" class="detail-section">
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
        <div v-if="selectedGood.sellingPrices && selectedGood.sellingPrices.length > 0" class="detail-section">
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

<script>
import apiService from '../services/apiService'

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
    }
  },
  computed: {
    totalPages() {
      return Math.ceil(this.totalCount / this.pageSize)
    }
  },
  mounted() {
    this.loadGoods()
    this.loadCategories()
  },
  methods: {
    async loadGoods() {
      this.loading = true
      try {
        const response = await apiService.getGoods({
          category_id: this.selectedCategory || undefined,
          item_type: this.selectedType || undefined,
          suspended: this.selectedStatus === 'suspended' ? true : 
                    this.selectedStatus === 'active' ? false : undefined,
          search: this.search || undefined,
          limit: this.pageSize,
          offset: (this.currentPage - 1) * this.pageSize
        })
        this.goods = response.data.data || []
        this.totalCount = response.data.pagination.count || 0
      } catch (err) {
        console.error('Failed to load goods:', err)
      } finally {
        this.loading = false
      }
    },
    async loadCategories() {
      try {
        const response = await apiService.getGoodsSummary()
        if (response.data && response.data.data && response.data.data.byType) {
          this.categories = [...new Set(response.data.data.byType.map(t => t.item_type))]
        }
      } catch (err) {
        console.error('Failed to load categories:', err)
      }
    },
    onSearch() {
      this.currentPage = 1
      this.loadGoods()
    },
    onFilterChange() {
      this.currentPage = 1
      this.loadGoods()
    },
    previousPage() {
      if (this.currentPage > 1) {
        this.currentPage--
        this.loadGoods()
      }
    },
    nextPage() {
      if (this.currentPage < this.totalPages) {
        this.currentPage++
        this.loadGoods()
      }
    },
    viewDetails(good) {
      this.selectedGood = good
    },
    formatCurrency(value) {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
      }).format(value)
    },
    formatDate(date) {
      if (!date) return '-'
      return new Date(date).toLocaleDateString('id-ID')
    }
  }
}
</script>

<style scoped>
.goods-table-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
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
  margin-bottom: 20px;
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
  font-size: 13px;
}

.goods-table td {
  padding: 12px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
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
  display: inline-block;
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
  padding: 20px;
}

.pagination button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
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
  font-size: 13px;
}

.detail-table td:first-child,
.detail-table th:first-child {
  font-weight: 600;
  width: 150px;
  background: #f5f5f5;
}
</style>
