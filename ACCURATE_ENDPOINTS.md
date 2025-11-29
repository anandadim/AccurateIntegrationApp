# Accurate Online API - Common Endpoints

Referensi endpoint yang sering digunakan dari Accurate Online API.

## Format Endpoint

Semua endpoint menggunakan format: `/{module}/{action}.do`

Contoh: `/customer/list.do`, `/item/detail.do`

## Master Data

### Customer (Pelanggan)
- `customer/list` - List semua customer
- `customer/detail` - Detail customer (perlu ID)

### Item (Produk/Barang)
- `item/list` - List semua item
- `item/detail` - Detail item (perlu ID)

### Vendor (Supplier)
- `vendor/list` - List semua vendor
- `vendor/detail` - Detail vendor (perlu ID)

## Transaksi

### Sales (Penjualan)
- `sales-invoice/list` - List invoice penjualan
- `sales-invoice/detail` - Detail invoice penjualan
- `sales-order/list` - List sales order
- `sales-quotation/list` - List quotation penjualan

### Purchase (Pembelian)
- `purchase-invoice/list` - List invoice pembelian
- `purchase-invoice/detail` - Detail invoice pembelian
- `purchase-order/list` - List purchase order

### Inventory
- `stock-mutation/list` - List mutasi stok
- `stock-opname/list` - List stock opname

## Financial

### General Ledger
- `gl-account/list` - List akun GL
- `journal-voucher/list` - List jurnal voucher

### Cash & Bank
- `cash-bank/list` - List kas & bank
- `cash-bank-in/list` - List penerimaan kas/bank
- `cash-bank-out/list` - List pengeluaran kas/bank

## Cara Penggunaan di App

### Via Frontend
Tambahkan button baru di `frontend/src/App.vue`:

```javascript
<button @click="fetchData('vendor/list')" :disabled="loading">
  Get Vendors
</button>
```

### Via API Langsung
```
GET http://localhost:3000/api/data/vendor/list?dbId=YOUR_DB_ID
```

## Parameter Tambahan

Beberapa endpoint mendukung parameter untuk filtering:

- `sp.pageSize` - Jumlah data per page (default: 25)
- `sp.page` - Nomor halaman
- `filter.field` - Filter berdasarkan field tertentu

Contoh:
```
/api/data/customer/list?dbId=123&sp.pageSize=50&sp.page=1
```

## Notes

- Semua endpoint memerlukan `X-Session-ID` header (dbId)
- Semua endpoint memerlukan `Authorization` header dengan Bearer token
- Response format biasanya: `{ s: true, d: [...data...] }`
- Untuk detail lengkap, lihat dokumentasi resmi Accurate Online API

## Referensi

Dokumentasi lengkap: https://accurate.id/api-documentation/
