Melihat histori mutasi stok (hanya menampilkan data 7 hari terakhir)

Parameter Request
Nama Parameter	Tipe Data	Harus diisi	Penjelasan
X-Session-ID
(HTTP Header Parameter)	
String
Tidak
Hanya dibutuhkan jika menggunakan Metode Otorisasi OAuth. Kode Session yang didapatkan dari response saat memanggil API /api/open-db.do
Cth: Halo Semua 123
filter.createDate
Filter hanya menampilkan data setelah tangal yang diinput
filter.createDate.op
BasicFilterOperator
Tidak
Jenis Operator penyaringan data (Default: EQUAL)
Nilai yang dapat digunakan
filter.createDate.val[n]
Timestamp
Tidak
Nilai yang akan digunakan untuk menyaring data. Jika nilai parameter yang dikirimkan hanya satu, boleh tidak menggunakan index pada nama parameter ([n]). Untuk Operator EQUAL, NOT_EQUAL, BETWEEN dan NOT_BETWEEN nilai parameter "val" bisa lebih dari 1 (gunakan index [n]). Untuk Operator EMPTY dan NOT_EMPTY nilai parameter "val" akan diabaikan
Cth: 31/03/2016 18:30:43
filter.transactionType
Filter data yang ingin ditampilkan berdasarkan nilai Jenis Transaksi
filter.transactionType.op
StringFilterOperator
Tidak
Jenis Operator penyaringan data (Default: EQUAL)
Nilai yang dapat digunakan
filter.transactionType.val[n]
String
Tidak
Nilai yang akan digunakan untuk menyaring data. Jika nilai parameter yang dikirimkan hanya satu, boleh tidak menggunakan index pada nama parameter ([n]). Untuk Operator EQUAL, NOT_EQUAL, BETWEEN dan NOT_BETWEEN nilai parameter "val" bisa lebih dari 1 (gunakan index [n]). Untuk Operator EMPTY dan NOT_EMPTY nilai parameter "val" akan diabaikan
Cth: Halo Semua 123