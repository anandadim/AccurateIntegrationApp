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
    <div class="bg-white rounded-xl shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th class="px-4 py-3 w-32">Invoice #</th>
              <th class="px-4 py-3 w-24">Date</th>
              <th class="px-4 py-3 w-48">Customer</th>
              <th class="px-4 py-3">Item</th>
              <th class="px-4 py-3 w-20 text-right">Qty</th>
              <th class="px-4 py-3 w-24 text-right">Unit Price</th>
              <th class="px-4 py-3 w-28 text-right">Amount</th>
              <th class="px-4 py-3 w-40">Sales</th>
              <th class="px-4 py-3 w-40">Warehouse</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            <template v-if="items && items.length > 0">
              <template v-for="invoice in items" :key="invoice.d?.id">
                <tr v-for="(item, idx) in invoice.d?.detailItem || []" :key="idx" 
                    class="hover:bg-gray-50">
                  <td class="px-4 py-3 text-sm font-medium text-blue-600">
                    {{ invoice.d?.number || 'N/A' }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500">
                    {{ formatDate(invoice.d?.transDateView) }}
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{{ invoice.d?.customer?.name || 'N/A' }}</div>
                    <div class="text-xs text-gray-500">{{ invoice.d?.customer?.customerNo || '' }}</div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm font-medium text-gray-900">{{ item.item?.name || 'N/A' }}</div>
                    <div class="text-xs text-gray-500">{{ item.item?.no || '' }}</div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500 text-right">
                    {{ formatNumber(item.quantity) }} <span class="text-gray-400">{{ item.itemUnit?.name || '' }}</span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500 text-right">
                    {{ formatCurrency(item.unitPrice) }}
                  </td>
                  <td class="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {{ formatCurrency(item.salesAmountBase) }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500">
                    {{ item.salesmanName || item.salesmanList?.[0]?.name || invoice.d?.masterSalesmanName || 'N/A' }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500">
                    {{ item.warehouse?.name || 'N/A' }}
                  </td>
                </tr>
                <!-- Invoice Total -->
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
              <td colspan="9" class="px-6 py-8 text-center text-sm text-gray-500">
                No data available
              </td>
            </tr>
            <tr v-if="loading">
              <td colspan="9" class="px-6 py-8 text-center text-sm text-gray-500">
                <div class="flex items-center justify-center">
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
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
}

th {
  text-align: left;
  background-color: #f9fafb;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 0 #e5e7eb;
}

/* Responsive table */
@media (max-width: 1024px) {
  .table-container {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  table {
    min-width: 100%;
    display: table;
  }
  
  th, td {
    white-space: nowrap;
  }
}
</style>
