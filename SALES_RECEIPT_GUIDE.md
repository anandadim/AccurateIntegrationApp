Findings
Studied existing salesInvoice backend:
Split into header (sales_invoices) & detail (sales_invoice_items) tables.
Fastify routes wired in 
backend/routes/api.js
 call a dedicated controller.
Controller workflow: check-sync → count (optional) → sync (stream / batch) → CRUD/summary.
Model wraps DB tx: upsert header then replace items.
Accurate API helpers live in 
services/accurateService.js
.
Key header vs detail differences observed in sample Sales-Receipt JSON (
data_salesReceipt
):
Header (d.*) holds receipt info, bank, customer, totals, etc.
Detail list (d.detailInvoice[]) links each receipt to an invoice (allocations, status).*
Implemented Backend for Sales-Receipt
Migration 
backend/migrations/create_sales_receipts_tables.sql
Creates sales_receipts & sales_receipt_items with useful indexes and updated_at trigger.
Model 
backend/models/salesReceiptModel.js
Upserts header & bulk-inserts items inside a PG transaction.
Helpers: 
getById
, 
getExistingForSync
, 
list
, 
getSummary
.
Controller 
backend/controllers/salesReceiptController.js
checkSyncStatus
, 
syncFromAccurate
 (stream-first), internal 
_saveBatch
, 
getReceipts
, 
getReceiptById
, 
getSummary
.
Robust date conversion & mapping from Accurate JSON.
Routes updated 
backend/routes/api.js
Added import & endpoints:
/sales-receipts/check-sync
/sales-receipts/sync
/sales-receipts (list)
/sales-receipts/:id
/sales-receipts/summary/stats_
Next Steps
Run new SQL migration on the database.
Test endpoints (check-sync then sync) for a branch/date range.
Add front-end components if needed.