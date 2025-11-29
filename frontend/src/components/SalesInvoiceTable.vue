<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Sales Invoices</h1>
      <p class="text-gray-600"></p>
    </div>
    
    <div class="container">
      <h2></h2>
      <p class="text-gray-600">View and manage your sales invoices in one place</p>
    <!-- Summary Table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div class="relative overflow-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Records
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fetched Invoices
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Page Size
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ summary.total }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ summary.fetched }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ summary.pageSize }}
              </td>
          </tbody>
        </table>
      </div>
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
                Date / Invoice
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer Details
              </th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item Description
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price (Per Unit)
              </th>
              <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qty
              </th>
              <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <template v-if="items && items.length > 0">
              <template v-for="invoice in items" :key="invoice.d?.id">
              <tr v-for="(item, idx) in invoice.d?.detailItem || []" :key="idx" 
               class="hover:bg-gray-50">
                <!-- Date / Invoice -->
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm text-gray-900">{{ formatDate(invoice.d?.transDateView) }}</div>
                  <div class="text-sm text-blue-600 font-medium">#{{ invoice.d?.number || 'N/A' }}</div>
                </td>

                <!-- Customer Details -->
                <td class="px-6 py-4">
                  <div class="text-sm font-medium text-gray-900">{{ invoice.d?.customer?.name || 'N/A' }}</div>
                  <div class="text-xs text-gray-500">ID: {{ invoice.d?.customer?.customerNo || 'N/A' }}</div>
                </td>

                <!-- Item Description -->
                <td class="px-6 py-4">
                  <!-- <template v-if="invoice.d?.detailItem?.length > 0"> -->
                    <div class="text-sm font-medium text-gray-900">{{ item.item?.name || 'N/A' }}</div>
                    <div class="text-xs text-gray-500">{{ item.item?.no || '' }}</div>
                    <!-- <div v-if="invoice.d.detailItem.length > 1" class="text-xs text-gray-500 mt-1">
                      +{{ invoice.d.detailItem.length - 1 }} more items
                    </div> -->
                  <!-- </template> -->
                  <!-- <div v-else class="text-sm text-gray-500">No items</div> -->
                </td>

                <!-- Price (Per Unit) -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {{ formatCurrency(item.unitPrice) || 'N/A' }}
                </td>

                <!-- Qty -->
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center">
                  
                    {{ formatNumber(item.quantity) }}<span class="text-gray-400">{{ item.itemUnit?.name || '' }}</span>
                 </td>

                <!-- Total -->
                <!-- <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                  {{ formatCurrency(invoice.d?.subTotal) }}
                </td>

                 -->
              </tr>
              <tr class="bg-gray-50 font-semibold">
                  <td colspan="5" class="px-4 py-2 text-right text-sm text-gray-900">
                    Invoice Total:
                  </td>
                  <td colspan="1" class="px-4 py-2 text-sm text-right text-gray-900">
                    {{ formatCurrency(invoice.d?.subTotal) }}
                  </td>
                  <td colspan="3"></td>
                </tr>
              </template>
            </template>
            <tr v-else-if="!loading">
              <td colspan="7" class="px-6 py-12 text-center">
                <div class="text-gray-500">
                  <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 class="mt-2 text-sm font-medium text-gray-900">No invoices</h3>
                  <p class="mt-1 text-sm text-gray-500">Get started by creating a new invoice.</p>
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
