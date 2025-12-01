<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Item Data Table</h1>
      <p class="text-gray-600">Display items from raw Accurate API data</p>
    </div>

    <!-- Search and Controls -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex-1 min-w-64">
          <input 
            type="text" 
            v-model="searchQuery" 
            @keyup.enter="filterItems"
            placeholder="Search items..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button 
          @click="filterItems" 
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          🔍 Search
        </button>
        <button 
          @click="loadRawData" 
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          📊 Load Raw Data
        </button>
        <button 
          @click="clearSearch" 
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          🔄 Clear
        </button>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-500">Total Items</div>
        <div class="text-2xl font-bold text-gray-900">{{ items.length }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-500">Filtered Results</div>
        <div class="text-2xl font-bold text-blue-600">{{ filteredItems.length }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-500">Categories</div>
        <div class="text-2xl font-bold text-green-600">{{ uniqueCategories }}</div>
      </div>
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="text-sm text-gray-500">Brands</div>
        <div class="text-2xl font-bold text-purple-600">{{ uniqueBrands }}</div>
      </div>
    </div>

    <!-- Main Table Container -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <!-- Table Wrapper with Fixed Height -->
      <div class="relative overflow-auto" style="max-height: 70vh;">
        <!-- Table with Minimum Width -->
        <table class="min-w-full divide-y divide-gray-200" style="min-width: 1200px;">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                No / ID
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nama Barang
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kategori Barang
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Jenis Barang
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kode Barang
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Satuan
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Merk Barang
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tax
              </th>
              <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stok
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warehouse
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <template v-if="filteredItems && filteredItems.length > 0">
              <tr v-for="(item, index) in paginatedItems" :key="item.id" class="hover:bg-gray-50">
                <!-- No / ID -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900 font-medium">{{ item.no || 'N/A' }}</div>
                  <div class="text-xs text-gray-500">ID: {{ item.id }}</div>
                </td>

                <!-- Nama Barang -->
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">{{ item.name || 'N/A' }}</div>
                  <div v-if="item.shortName" class="text-xs text-gray-500">{{ item.shortName }}</div>
                </td>

                <!-- Kategori Barang -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.categoryName || '-' }}
                </td>

                <!-- Jenis Barang -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.itemTypeName || '-' }}
                </td>

                <!-- Kode Barang -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.no || '-' }}
                </td>

                <!-- Satuan -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.unit1Name || '-' }}
                </td>

                <!-- Merk Barang -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.brandName || '-' }}
                </td>

                <!-- Tax -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div v-if="item.tax1Id || item.tax2Id">
                    <div v-if="item.tax1Id" class="text-xs">Tax1: {{ item.tax1Id }}</div>
                    <div v-if="item.tax2Id" class="text-xs">Tax2: {{ item.tax2Id }}</div>
                    <div v-if="item.percentTaxable" class="text-xs text-green-600">{{ item.percentTaxable }}%</div>
                  </div>
                  <div v-else>-</div>
                </td>

                <!-- Stok -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                  <span class="px-2 py-1 text-xs rounded-full" :class="getStockClass(item.balance)">
                    {{ formatNumber(item.balance) }}
                  </span>
                </td>

                <!-- Warehouse -->
                <td class="px-6 py-4 text-sm text-gray-500">
                  <div v-if="item.warehouseData && item.warehouseData.length > 0">
                    <div v-for="warehouse in item.warehouseData" :key="warehouse.id" class="flex justify-between py-1">
                      <span class="text-xs">{{ warehouse.name }}</span>
                      <span class="text-xs font-medium">{{ formatNumber(warehouse.balance) }}</span>
                    </div>
                  </div>
                  <div v-else>-</div>
                </td>
              </tr>
            </template>
            <tr v-else-if="!loading">
              <td colspan="10" class="px-6 py-12 text-center">
                <div class="text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <h3 class="mt-2 text-sm font-medium text-gray-900">No items found</h3>
                  <p class="mt-1 text-sm text-gray-500">Click "Load Raw Data" to display items from the data file.</p>
                </div>
              </td>
            </tr>
            <tr v-if="loading">
              <td colspan="10" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center">
                  <svg class="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-sm text-gray-500">Loading raw data...</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="filteredItems.length > pageSize" class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mt-4">
      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-700">
          Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, filteredItems.length) }} of {{ filteredItems.length }} results
        </div>
        <div class="flex gap-2">
          <button 
            @click="currentPage--" 
            :disabled="currentPage === 1"
            class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span class="px-3 py-1 bg-blue-600 text-white rounded">
            {{ currentPage }}
          </span>
          <button 
            @click="currentPage++" 
            :disabled="currentPage >= totalPages"
            class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ItemDataTable',
  data() {
    return {
      items: [],
      filteredItems: [],
      searchQuery: '',
      loading: false,
      currentPage: 1,
      pageSize: 50
    }
  },
  computed: {
    totalPages() {
      return Math.ceil(this.filteredItems.length / this.pageSize)
    },
    paginatedItems() {
      const start = (this.currentPage - 1) * this.pageSize
      const end = start + this.pageSize
      return this.filteredItems.slice(start, end)
    },
    uniqueCategories() {
      const categories = new Set(this.items.map(item => item.categoryName).filter(Boolean))
      return categories.size
    },
    uniqueBrands() {
      const brands = new Set(this.items.map(item => item.brandName).filter(Boolean))
      return brands.size
    }
  },
  methods: {
    async loadRawData() {
      this.loading = true
      try {
        // Import the raw data file
        const rawData = await import('../../data')
        
        if (rawData.default && rawData.default.items) {
          // Process the raw data
          this.items = rawData.default.items.map(item => item.d).map(this.processItem)
          this.filteredItems = [...this.items]
          this.currentPage = 1
          console.log(`📦 Loaded ${this.items.length} items from raw data`)
        } else {
          console.error('Invalid data format')
        }
      } catch (error) {
        console.error('Error loading raw data:', error)
        // Fallback: try to fetch the data file directly
        this.fetchDataFile()
      } finally {
        this.loading = false
      }
    },

    async fetchDataFile() {
      try {
        const response = await fetch('/data')
        const data = await response.json()
        
        if (data.items) {
          this.items = data.items.map(item => item.d).map(this.processItem)
          this.filteredItems = [...this.items]
          this.currentPage = 1
          console.log(`📦 Loaded ${this.items.length} items from data file`)
        }
      } catch (error) {
        console.error('Error fetching data file:', error)
      }
    },

    processItem(rawItem) {
      return {
        id: rawItem.id,
        no: rawItem.no,
        name: rawItem.name,
        shortName: rawItem.shortName,
        categoryName: rawItem.itemCategory?.name || null,
        itemTypeName: rawItem.itemTypeName || null,
        unit1Name: rawItem.unit1?.name || null,
        brandName: rawItem.itemBrand?.name || rawItem.brand?.name || null,
        tax1Id: rawItem.tax1Id,
        tax2Id: rawItem.tax2Id,
        percentTaxable: rawItem.percentTaxable,
        balance: rawItem.balance || 0,
        warehouseData: rawItem.detailWarehouseData || [],
        suspended: rawItem.suspended || false
      }
    },

    filterItems() {
      if (!this.searchQuery.trim()) {
        this.filteredItems = [...this.items]
      } else {
        const query = this.searchQuery.toLowerCase()
        this.filteredItems = this.items.filter(item => 
          (item.no && item.no.toLowerCase().includes(query)) ||
          (item.name && item.name.toLowerCase().includes(query)) ||
          (item.categoryName && item.categoryName.toLowerCase().includes(query)) ||
          (item.brandName && item.brandName.toLowerCase().includes(query))
        )
      }
      this.currentPage = 1
    },

    clearSearch() {
      this.searchQuery = ''
      this.filteredItems = [...this.items]
      this.currentPage = 1
    },

    getStockClass(stock) {
      if (stock === 0) {
        return 'bg-red-100 text-red-800'
      } else if (stock < 10) {
        return 'bg-yellow-100 text-yellow-800'
      } else {
        return 'bg-green-100 text-green-800'
      }
    },

    formatNumber(num) {
      if (!num && num !== 0) return '0'
      return parseFloat(num).toLocaleString('id-ID', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
      })
    }
  },
  mounted() {
    // Auto-load data when component mounts
    this.loadRawData()
  }
}
</script>

<style scoped>
/* Table styles */
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}

th {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: #f9fafb;
  padding: 0.75rem 1.5rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  vertical-align: top;
}

tbody tr:last-child td {
  border-bottom: none;
}

/* Hover effect */
tbody tr:hover {
  background-color: #f9fafb;
}

/* Scrollable container */
.overflow-auto {
  scrollbar-width: thin;
  scrollbar-color: #d1d5db #f3f4f6;
  max-height: 70vh;
  overflow: auto;
  display: block;
}

/* Custom scrollbar for WebKit browsers */
.overflow-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: #f3f4f6;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background-color: #9ca3af;
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background-color: #6b7280;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .overflow-auto {
    -webkit-overflow-scrolling: touch;
    max-height: 60vh;
  }
  
  td, th {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
  
  .text-sm {
    font-size: 0.8125rem;
  }
  
  .text-xs {
    font-size: 0.75rem;
  }
}
</style>
