# Sales Invoice Display Guide

## Overview

Frontend sekarang sudah dilengkapi dengan tampilan tabel khusus untuk Sales Invoice yang menampilkan detail item sesuai format laporan "Rincian Penjualan per Barang".

## Features

### 1. View Mode Toggle
- **Simple View**: Menampilkan raw JSON response
- **Table View**: Menampilkan data dalam format tabel yang rapi

### 2. Sales Invoice Card
Setiap invoice ditampilkan dalam card yang berisi:
- **Header**: Nomor Invoice & Tanggal
- **Info**: Customer, Customer ID, Sales, Warehouse
- **Detail Items Table**: Tabel dengan kolom:
  - No. Barang (Item Code)
  - Keterangan Barang (Item Description)
  - Qty (Quantity)
  - Unit
  - Harga Satuan (Unit Price)
  - Diskon (Discount)
  - Jumlah (Amount)
- **Total**: Total amount di footer tabel

### 3. Summary Box
Menampilkan:
- Total Records di database
- Jumlah invoice yang di-fetch
- Page & Page Size info

## Field Mapping

Dari Accurate API response ke display:

| Display Field | API Field | Description |
|---------------|-----------|-------------|
| No. Faktur | `number` | Invoice number |
| Tanggal | `transDate` | Transaction date |
| Customer | `customerName` | Customer name |
| ID Pelanggan | `customerId` | Customer ID |
| Sales | `salesmanName` | Salesman name |
| Gudang | `warehouseName` | Warehouse name |
| No. Barang | `detailItem[].itemNo` | Item code |
| Keterangan Barang | `detailItem[].itemName` | Item description |
| Kuantitas | `detailItem[].quantity` | Quantity |
| Unit | `detailItem[].unitName` | Unit of measure |
| Harga Satuan | `detailItem[].unitPrice` | Unit price |
| Diskon | `detailItem[].discount` | Discount amount |
| Jumlah | `detailItem[].amount` | Line total |
| Total | `total` | Invoice total |

## How to Use

1. **Select Database** - Pilih cabang dari dropdown
2. **Click "Sales Invoice (List + Details)"** - Fetch data
3. **Toggle View** - Switch antara Table View dan Simple View
4. **Adjust Max Items** - Set berapa banyak invoice yang ingin di-fetch (default: 20)

## Response Structure

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 1344,
      "fetched": 20,
      "page": 1,
      "pageSize": 20
    },
    "items": [
      {
        "d": {
          "id": 2425,
          "number": "SI.2025.11.00139",
          "transDate": "2025-11-10",
          "customerName": "Bp Didik Semarang",
          "customerId": "C.00054",
          "salesmanName": "Muhammad Amir",
          "warehouseName": "SEMARANG",
          "total": 19240000,
          "detailItem": [
            {
              "itemNo": "140010-14.075IN.02272",
              "itemName": "FLANK (AMROON)...",
              "quantity": 260,
              "unitName": "KG",
              "unitPrice": 74000,
              "discount": 0,
              "amount": 19240000
            }
          ]
        }
      }
    ],
    "errors": []
  }
}
```

## Formatting

- **Currency**: Format Indonesia (Rp 19.240.000)
- **Numbers**: 2 decimal places (260.00)
- **Dates**: Format Indonesia (10 Nov 2025)

## Notes

- Data otomatis di-cache ke SQLite setelah fetch
- Error handling untuk item yang gagal di-fetch
- Responsive design untuk mobile & desktop
- Hover effect pada table rows

## Future Enhancements

Bisa ditambahkan:
- [ ] Filter by date range
- [ ] Filter by customer
- [ ] Filter by sales
- [ ] Export to CSV
- [ ] Print invoice
- [ ] Pagination controls
- [ ] Search functionality
- [ ] Sort by column

---

**Created:** 2024  
**Component:** `frontend/src/components/SalesInvoiceTable.vue`
