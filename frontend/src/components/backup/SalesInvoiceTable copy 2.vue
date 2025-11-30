<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Sales Invoices</h1>
      <p class="text-gray-600">View and manage your sales invoices in one place</p>
    </div>

    <!-- Summary Cards -->
    <div v-if="summary" class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
        <p class="text-sm font-medium text-gray-500">Total Records</p>
        <p class="text-2xl font-semibold">{{ summary.total }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
        <p class="text-sm font-medium text-gray-500">Fetched Invoices</p>
        <p class="text-2xl font-semibold">{{ summary.fetched }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
        <p class="text-sm font-medium text-gray-500">Current Page</p>
        <p class="text-2xl font-semibold">{{ summary.page }}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
        <p class="text-sm font-medium text-gray-500">Page Size</p>
        <p class="text-2xl font-semibold">{{ summary.pageSize }}</p>
      </div>
    </div>

    <!-- Main Table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-auto max-h-[70vh]">
        <table class="w-full">
          <thead class="sticky top-0 z-10">
            <tr class="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
              <th class="px-6 py-3 w-48">Date / Invoice</th>
              <th class="px-6 py-3 w-64">Customer Details</th>
              <th class="px-6 py-3">Item Description</th>
              <th class="px-6 py-3 w-32 text-right">Price (Per Unit)</th>
              <th class="px-6 py-3 w-24 text-center">Qty</th>
              <th class="px-6 py-3 w-32 text-right">Total</th>
              <th class="px-6 py-3 w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <template v-if="items && items.length > 0">
              <template v-for="(invoice, invIdx) in items" :key="invoice.d?.id">
                <tr v-for="(item, itemIdx) in invoice.d?.detailItem || []" :key="itemIdx" 
                    class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <!-- Date / Invoice -->
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-900">{{ formatDate(invoice.d?.transDateView) }}</div>
                    <div class="text-xs text-blue-600 font-medium">#{{ invoice.d?.number || 'N/A' }}</div>
                  </td>
                  
                  <!-- Customer Details -->
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">{{ invoice.d?.customer?.name || 'N/A' }}</div>
                    <div class="text-xs text-gray-500">ID: {{ invoice.d?.customer?.customerNo || 'N/A' }}</div>
                  </td>
                  
                  <!-- Item Description -->
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">{{ item.item?.name || 'N/A' }}</div>
                    <div class="text-xs text-gray-500">{{ item.item?.no || 'N/A' }}</div>
                  </td>
                  
                  <!-- Price (Per Unit) -->
                  <td class="px-6 py-4 text-sm text-gray-900 text-right">
                    {{ formatCurrency(item.unitPrice) }}
                  </td>
                  
                  <!-- Qty -->
                  <td class="px-6 py-4 text-sm text-center">
                    <span class="inline-block bg-gray-100 rounded-full px-3 py-1 text-sm font-medium text-gray-700">
                      {{ formatNumber(item.quantity) }} {{ item.itemUnit?.name || '' }}
                    </span>
                  </td>
                  
                  <!-- Total -->
                  <td class="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                    {{ formatCurrency(item.salesAmountBase) }}
                  </td>
                  
                  <!-- Actions -->
                  <td class="px-6 py-4 text-right">
                    <button class="text-blue-600 hover:text-blue-800 text-sm font-medium">
                      View
                    </button>
                  </td>
                </tr>
                
                <!-- Invoice Total -->
                <tr v-if="itemIdx === (invoice.d?.detailItem?.length - 1)" class="bg-gray-50 font-medium">
                  <td colspan="5" class="px-6 py-3 text-right text-sm text-gray-700">
                    Invoice Total:
                  </td>
                  <td class="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    {{ formatCurrency(invoice.d?.subTotal) }}
                  </td>
                  <td></td>
                </tr>
              </template>
            </template>
            <tr v-else-if="!loading">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p class="text-gray-500 font-medium">No invoices found</p>
                  <p class="text-sm text-gray-400 mt-1">Try adjusting your search or filter</p>
                </div>
              </td>
            </tr>
            <tr v-if="loading">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center">
                  <svg class="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span class="text-sm text-gray-500">Loading invoices...</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SalesInvoiceTable',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    summary: {
      type: Object,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    formatDate(dateStr) {
      if (!dateStr) return 'N/A'
      const date = new Date(dateStr)
      return date.toLocaleDateString('id-ID', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      })
    },
    formatNumber(num) {
      if (!num && num !== 0) return '0'
      return parseFloat(num).toLocaleString('id-ID', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
      })
    },
    formatCurrency(num) {
      if (!num && num !== 0) return 'Rp 0'
      return 'Rp ' + parseFloat(num).toLocaleString('id-ID', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
      })
    }
  }
}
</script>

<style scoped>
/* Table styles */
table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  min-width: 900px;
}

th {
  text-align: left;
  background-color: #f9fafb;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 0 #e5e7eb;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.7rem;
  padding: 0.75rem 1.5rem;
}

td {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}

tr:last-child td {
  border-bottom: none;
}

/* Scrollable container */
.overflow-auto {
  scrollbar-width: thin;
  scrollbar-color: #e5e7eb #f9fafb;
}

.overflow-auto::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: #f9fafb;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background-color: #e5e7eb;
  border-radius: 4px;
}

/* Hover effect */
tr:hover {
  background-color: #f9fafb;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .overflow-auto {
    -webkit-overflow-scrolling: touch;
  }
  
  table {
    min-width: 100%;
  }
  
  th, td {
    white-space: nowrap;
  }
}
</style>
