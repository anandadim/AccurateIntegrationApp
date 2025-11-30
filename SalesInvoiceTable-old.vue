<template>
  <div class="invoice-container">
    <div v-if="summary" class="summary-box">
      <h3>Summary</h3>
      <p>Total Records: {{ summary.total }}</p>
      <p>Fetched: {{ summary.fetched }} invoices</p>
      <p>Page: {{ summary.page }} | Page Size: {{ summary.pageSize }}</p>
    </div>

    <div v-if="items && items.length > 0">
      <h3>Sales Invoice Details</h3>
      
      <div v-for="invoice in items" :key="invoice.d?.id" class="invoice-card">
        <div class="invoice-header">
          <h4>{{ invoice.d?.number || 'N/A' }}</h4>
          <span class="invoice-date">{{ formatDate(invoice.d?.transDate) }}</span>
        </div>
        
        <div class="invoice-info">
          <div class="info-row">
            <strong>ID Pelanggan:</strong> {{ invoice.d?.customer?.customerNo || 'N/A' }}
          </div>
          <div class="info-row">
            <strong>Pelanggan:</strong> {{ invoice.d?.customer?.name || 'N/A' }}
          </div>
          <div class="info-row">
            <strong>HP Pelanggan:</strong> {{ invoice.d?.customer?.contactInfo?.mobilePhone || 'N/A' }}
          </div>
          <div class="info-row">
            <strong>Total:</strong> {{ formatCurrency(invoice.d?.subTotal) }}
          </div>
        </div>

        <!-- Detail Items Table -->
        <div v-if="invoice.d?.detailItem && invoice.d.detailItem.length > 0" class="items-table-container">
          <table class="items-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>No. Faktur</th>
                <th>No. Barang</th>
                <th>Keterangan Barang</th>
                <th>Kuantitas</th>
                <th>Unit</th>
                <th>Harga Satuan</th>
                <th>Jumlah</th>
                <th>Gudang</th>
                <th>ID Pelanggan</th>
                <th>Pelanggan</th>
                <th>Sales</th>
                <th>HP Pelanggan</th>
                <th>Diskon</th>
                <th>Nama Kategori Barang</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in invoice.d.detailItem" :key="idx">
                <td>{{ formatDate(invoice.d?.transDate) }}</td>
                <td>{{ invoice.d?.number || 'N/A' }}</td>
                <td>{{ item.item?.no || 'N/A' }}</td>
                <td class="item-desc">{{ item.item?.name || 'N/A' }}</td>
                <td class="text-right">{{ formatNumber(item.quantity) }}</td>
                <td>{{ item.itemUnit?.name || 'N/A' }}</td>
                <td class="text-right">{{ formatCurrency(item.unitPrice) }}</td>
                <td class="text-right">{{ formatCurrency(item.salesAmountBase) }}</td>
                <td>{{ item.warehouse?.name || 'N/A' }}</td>
                <td>{{ invoice.d?.customer?.customerNo || 'N/A' }}</td>
                <td>{{ invoice.d?.customer?.name || 'N/A' }}</td>
                <td>{{ item.salesmanName || item.salesmanList?.[0]?.name || invoice.d?.masterSalesmanName || 'N/A' }}</td>
                <td>{{ invoice.d?.customer?.contactInfo?.mobilePhone || 'N/A' }}</td>
                <td class="text-right">{{ formatCurrency(item.itemCashDiscount || 0) }}</td>
                <td>{{ item.item?.itemCategoryId || 'N/A' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="7"><strong>Grand Total</strong></td>
                <td class="text-right"><strong>{{ formatCurrency(invoice.d?.subTotal) }}</strong></td>
                <td colspan="7"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <div v-else-if="!loading">
      <p>No data available</p>
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
.invoice-container {
  margin-top: 20px;
}

.summary-box {
  background: #e3f2fd;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.summary-box h3 {
  margin-top: 0;
  margin-bottom: 12px;
}

.summary-box p {
  margin: 4px 0;
}

.invoice-card {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 2px solid #42b983;
  margin-bottom: 16px;
}

.invoice-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 18px;
}

.invoice-date {
  color: #666;
  font-size: 14px;
}

.invoice-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.info-row {
  font-size: 14px;
}

.info-row strong {
  color: #555;
  margin-right: 8px;
}

.items-table-container {
  overflow-x: auto;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.items-table th {
  background: #f8f9fa;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #ddd;
  white-space: nowrap;
}

.items-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #eee;
}

.items-table tbody tr:hover {
  background: #f8f9fa;
}

.item-desc {
  max-width: 300px;
  white-space: normal;
}

.text-right {
  text-align: right;
}

.total-row {
  background: #f0f0f0;
  font-weight: bold;
}

.total-row td {
  padding: 12px 8px;
  border-top: 2px solid #ddd;
}
</style>
