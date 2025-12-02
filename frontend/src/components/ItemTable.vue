<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Items</h1>
      <p class="text-gray-600">View and manage your items in one place</p>
    </div>

    <!-- Search and Controls -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex-1 min-w-64">
          <input 
            type="text" 
            v-model="searchQuery" 
            @keyup.enter="searchItems"
            placeholder="Search items..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button 
          @click="searchItems" 
          :disabled="loading"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Searching...' : 'Search' }}
        </button>
        <button 
          @click="loadItems" 
          :disabled="loading"
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading ? 'Loading...' : 'Load All' }}
        </button>
      </div>
    </div>

    <!-- Main Table Container -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <!-- Table Wrapper with Fixed Height -->
      <div class="relative overflow-auto" style="max-height: 70vh;">
        <!-- Table with Minimum Width -->
        <table class="min-w-full divide-y divide-gray-200" style="min-width: 1024px;">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Code/No
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Name
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brand
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tax
              </th>
              <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <template v-if="items && items.length > 0">
              <tr v-for="item in items" :key="item.id" class="hover:bg-gray-50">
                <!-- Item Code/No -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{{ item.itemNo || item.no || 'N/A' }}</div>
                  <div class="text-xs text-gray-500">ID: {{ item.id || item.id }}</div>
                </td>

                <!-- Item Name -->
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">{{ item.itemName || item.name || 'N/A' }}</div>
                </td>

                <!-- Category -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.category || '-' }}
                </td>

                <!-- Type -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.itemType || '-' }}
                </td>

                <!-- Unit -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.unit || '-' }}
                </td>

                <!-- Brand -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ item.brand || '-' }}
                </td>

                <!-- Tax -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div v-if="item.tax">
                    <div v-if="item.tax.isTaxIncluded" class="text-xs text-green-600">Included</div>
                    <div class="text-xs">
                      <span v-if="item.tax.tax1Rate">Tax1: {{ item.tax.tax1Rate }}%</span>
                      <span v-if="item.tax.tax2Rate" class="ml-1">Tax2: {{ item.tax.tax2Rate }}%</span>
                    </div>
                  </div>
                  <div v-else>-</div>
                </td>

                <!-- Stock -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                  <span class="px-2 py-1 text-xs rounded-full" :class="getStockClass(item.stock)">
                    {{ formatNumber(item.stock) }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                  <button 
                    @click="viewItemDetails(item.id)"
                    class="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    View
                  </button>
                  <button 
                    @click="syncItem(item.id)"
                    :disabled="syncingItems.has(item.id)"
                    class="text-green-600 hover:text-green-900 disabled:opacity-50"
                  >
                    {{ syncingItems.has(item.id) ? 'Syncing...' : 'Sync' }}
                  </button>
                </td>
              </tr>
            </template>
            <tr v-else-if="!loading">
              <td colspan="9" class="px-6 py-12 text-center">
                <div class="text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <h3 class="mt-2 text-sm font-medium text-gray-900">No items</h3>
                  <p class="mt-1 text-sm text-gray-500">Get started by loading items from Accurate.</p>
                </div>
              </td>
            </tr>
            <tr v-if="loading">
              <td colspan="9" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center">
                  <svg class="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-sm text-gray-500">Loading items...</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Item Details Modal -->
    <div v-if="selectedItem" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" @click="closeModal">
      <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white" @click.stop>
        <div class="mt-3">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-medium text-gray-900">Item Details</h3>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700">Item No</label>
                <p class="mt-1 text-sm text-gray-900">{{ selectedItem.itemNo || '-' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Item Name</label>
                <p class="mt-1 text-sm text-gray-900">{{ selectedItem.itemName || '-' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Category</label>
                <p class="mt-1 text-sm text-gray-900">{{ selectedItem.category || '-' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Type</label>
                <p class="mt-1 text-sm text-gray-900">{{ selectedItem.itemType || '-' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Unit</label>
                <p class="mt-1 text-sm text-gray-900">{{ selectedItem.unit || '-' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Brand</label>
                <p class="mt-1 text-sm text-gray-900">{{ selectedItem.brand || '-' }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Stock</label>
                <p class="mt-1 text-sm text-gray-900">{{ formatNumber(selectedItem.stock) }}</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700">Tax</label>
                <p class="mt-1 text-sm text-gray-900">
                  <span v-if="selectedItem.tax">
                    {{ selectedItem.tax.isTaxIncluded ? 'Included' : 'Not Included' }}
                    <span v-if="selectedItem.tax.tax1Rate"> ({{ selectedItem.tax.tax1Rate }}%)</span>
                  </span>
                  <span v-else>-</span>
                </p>
              </div>
            </div>

            <!-- Warehouse Stock -->
            <div v-if="selectedItem.warehouses && selectedItem.warehouses.length > 0">
              <h4 class="text-md font-medium text-gray-900 mb-2">Warehouse Stock</h4>
              <div class="bg-gray-50 rounded-lg p-4">
                <div v-for="warehouse in selectedItem.warehouses" :key="warehouse.warehouseId" class="flex justify-between py-2 border-b border-gray-200 last:border-0">
                  <span class="text-sm text-gray-900">{{ warehouse.warehouseName }}</span>
                  <span class="text-sm font-medium text-gray-900">{{ formatNumber(warehouse.stockQuantity) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import apiService from '../services/apiService'

export default {
  name: 'ItemTable',
  props: {
    dbId: {
      type: String,
      required: true
    },
    branchId: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      items: [],
      loading: false,
      searchQuery: '',
      selectedItem: null,
      syncingItems: new Set()
    }
  },
  methods: {
    async loadItems() {
      this.loading = true
      try {
        const result = await apiService.getItems({ 
          db: this.dbId, 
          branch: this.branchId,
          limit: 100 
        })
        if (result.success) {
          this.items = result.data || []
        } else {
          console.error('Error loading items:', result.error)
        }
      } catch (error) {
        console.error('Error loading items:', error)
      } finally {
        this.loading = false
      }
    },

    async searchItems() {
      if (!this.searchQuery.trim()) {
        this.loadItems()
        return
      }
      
      this.loading = true
      try {
        const result = await apiService.getItems({ 
          db: this.dbId, 
          branch: this.branchId,
          q: this.searchQuery,
          limit: 100 
        })
        if (result.success) {
          this.items = result.data || []
        } else {
          console.error('Error searching items:', result.error)
        }
      } catch (error) {
        console.error('Error searching items:', error)
      } finally {
        this.loading = false
      }
    },

    async viewItemDetails(itemId) {
      try {
        const result = await apiService.getItemDetails(itemId)
        if (result.success) {
          this.selectedItem = result.data
        } else {
          console.error('Error fetching item details:', result.error)
        }
      } catch (error) {
        console.error('Error fetching item details:', error)
      }
    },

    async syncItem(itemId) {
      this.syncingItems.add(itemId)
      try {
        const result = await apiService.syncItem(itemId, { 
          db: this.dbId, 
          branch: this.branchId 
        })
        if (result.success) {
          // Refresh the item details if modal is open
          if (this.selectedItem && this.selectedItem.id === itemId) {
            await this.viewItemDetails(itemId)
          }
          // Refresh the items list
          await this.loadItems()
        } else {
          console.error('Error syncing item:', result.error)
        }
      } catch (error) {
        console.error('Error syncing item:', error)
      } finally {
        this.syncingItems.delete(itemId)
      }
    },

    closeModal() {
      this.selectedItem = null
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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
      })
    }
  },
  mounted() {
    this.loadItems()
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

/* For Firefox */
@supports (scrollbar-color: #9ca3af #f3f4f6) {
  .overflow-auto {
    scrollbar-color: #9ca3af #f3f4f6;
  }
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
