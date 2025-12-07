<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-800 mb-2">Sales Receipts</h1>
      <p class="text-gray-600">View and analyse customer receipts</p>
    </div>

    <!-- Summary -->
    <div v-if="summary" class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
      <div class="relative overflow-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Records</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fetched</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page Size</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ summary.total }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ summary.fetched }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ summary.pageSize }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Main table -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div class="relative overflow-auto" style="max-height: 70vh;">
        <table class="min-w-full divide-y divide-gray-200" style="min-width: 1024px;">
          <thead class="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date / Receipt</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice No</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice Total</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
              <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <template v-if="items && items.length">
              <template v-for="receipt in items" :key="receipt.d?.id">
                <tr v-for="(inv, idx) in receipt.d?.detailInvoice || []" :key="idx" class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">{{ formatDate(receipt.d?.transDateView) }}</div>
                    <div class="text-sm text-blue-600 font-medium">#{{ receipt.d?.number }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-gray-900">{{ receipt.d?.customer?.name }}</div>
                    <div class="text-xs text-gray-500">ID: {{ receipt.d?.customer?.customerNo }}</div>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900">{{ inv.invoice?.number }}</td>
                  <td class="px-6 py-4 text-sm text-right text-gray-900">{{ formatCurrency(inv.invoice?.totalAmount) }}</td>
                  <td class="px-6 py-4 text-sm text-right text-gray-900">{{ formatCurrency(inv.invoicePayment) }}</td>
                  <td class="px-6 py-4 text-sm text-right text-gray-900">{{ formatCurrency(inv.invoice?.owingForPayment) }}</td>
                  <td class="px-6 py-4 text-sm text-gray-900">{{ receipt.d?.bank?.name }}</td>
                  <td class="px-6 py-4 text-sm">{{ inv.invoice?.status }}</td>
                </tr>
                <tr class="bg-gray-50 font-semibold">
                  <td colspan="7" class="px-4 py-2 text-right text-sm text-gray-900">Receipt Total:</td>
                  <td class="px-4 py-2 text-sm text-right text-gray-900">{{ formatCurrency(receipt.d?.totalPayment) }}</td>
                </tr>
              </template>
            </template>
            <tr v-else-if="!loading">
              <td colspan="8" class="px-6 py-12 text-center text-gray-500">No receipts</td>
            </tr>
            <tr v-if="loading">
              <td colspan="8" class="px-6 py-12 text-center">
                <svg class="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="text-sm text-gray-500">Loading receipts...</span>
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
  name: 'SalesReceiptTable',
  props: {
    items: { type: Array, default: () => [] },
    summary: { type: Object, default: null },
    loading: { type: Boolean, default: false }
  },
  methods: {
    formatDate(s) {
      if(!s) return 'N/A';
      return new Date(s).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    },
    formatCurrency(n){
      if(n===null||n===undefined) return 'Rp 0';
      return 'Rp '+parseFloat(n).toLocaleString('id-ID', {minimumFractionDigits:0});
    }
  }
}
</script>

<style scoped>
/* reuse styles from SalesInvoiceTable */
</style>
