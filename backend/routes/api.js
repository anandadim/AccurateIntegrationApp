const accurateController = require('../controllers/accurateController');
const salesInvoiceController = require('../controllers/salesInvoiceController');
const salesOrderController = require('../controllers/salesOrderController');
const purchaseInvoiceController = require('../controllers/purchaseInvoiceController');
const itemController = require('../controllers/itemController');
const customerController = require('../controllers/customerController');
const salesReceiptController = require('../controllers/salesReceiptController');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const salesReturnController = require('../controllers/salesReturnController');


async function routes(fastify, options) {
  // Test endpoint
  fastify.get('/test', async (request, reply) => {
    return { message: 'API routes working' };
  });

  // Get branches list
  fastify.get('/branches', accurateController.getBranches);

  // Reload branches config
  fastify.post('/branches/reload', accurateController.reloadBranches);

  // Get database list (untuk pilih cabang)
  fastify.get('/databases', accurateController.getDatabases);

  // Get data dari endpoint tertentu
  fastify.get('/data/:endpoint', accurateController.getData);

  // Get cached data
  fastify.get('/cache/:endpoint', accurateController.getCachedData);

  // Get list with all details
  fastify.get('/details/:endpoint', accurateController.getListWithDetails);

  // === goods / item Endpoints (PostgreSQL) ===

  // Get items
  fastify.get('/item', accurateController.getItems);

  // Get item details by ID
  fastify.get('/items/:id', itemController.getItemDetails);

  // Sync item data from Accurate
  fastify.post('/items/:id/sync', itemController.syncItem);

  // === Item Sync Endpoints ===
  fastify.get('/items/check-sync', itemController.checkSyncStatus);
  
  fastify.post('/items/sync-smart', itemController.syncItemsSmart);

  // === Customer Endpoints ===
  fastify.get('/customers/check-sync', customerController.checkSyncStatus);
  fastify.post('/customers/sync-smart', customerController.syncSmart);
  fastify.get('/customers', customerController.getCustomers);
  fastify.get('/customers/:id', customerController.getCustomerById);

  // === Sales Invoice Endpoints (PostgreSQL) ===
  
  // Check sync status (compare API vs DB)
  fastify.get('/sales-invoices/check-sync', salesInvoiceController.checkSyncStatus);
  
  // Count invoices without fetching (dry-run)
  fastify.get('/sales-invoices/count', salesInvoiceController.countInvoices);
  
  // Sync sales invoices from Accurate API to PostgreSQL
  fastify.post('/sales-invoices/sync', salesInvoiceController.syncFromAccurate);
  
  // Smart sync: Only sync new + updated invoices
  fastify.post('/sales-invoices/sync-smart', salesInvoiceController.syncSmart);
  
  // Get sales invoices from database
  fastify.get('/sales-invoices', salesInvoiceController.getInvoices);
  
  // Get invoice detail by ID
  fastify.get('/sales-invoices/:id', salesInvoiceController.getInvoiceById);
  
  // Get summary statistics
  fastify.get('/sales-invoices/summary/stats', salesInvoiceController.getSummary);

  // === Sales Order Endpoints (PostgreSQL) ===
  
  // Check sync status (compare API vs DB)
  fastify.get('/sales-orders/check-sync', salesOrderController.checkSyncStatus);
  
  // Smart sync: Only sync new + updated orders
  fastify.post('/sales-orders/sync-smart', salesOrderController.syncSmart);
  
  // Get sales orders from database
  fastify.get('/sales-orders', salesOrderController.getOrders);
  
  // Get order detail by ID
  fastify.get('/sales-orders/:id', salesOrderController.getOrderById);
  
  // Get summary statistics
  fastify.get('/sales-orders/summary/stats', salesOrderController.getSummary);

  // === Sales Receipt Endpoints (PostgreSQL) ===
  // Check sync status (compare API vs DB)
  fastify.get('/sales-receipts/check-sync', salesReceiptController.checkSyncStatus);
  
  // Sync sales receipts from Accurate API to PostgreSQL
  fastify.post('/sales-receipts/sync', salesReceiptController.syncFromAccurate);
  
  // Get sales receipts from database
  fastify.get('/sales-receipts', salesReceiptController.getReceipts);
  
  // Get receipt detail by ID
  fastify.get('/sales-receipts/:id', salesReceiptController.getReceiptById);
  
  // Get summary statistics
  fastify.get('/sales-receipts/summary/stats', salesReceiptController.getSummary);

  
  // === Sales Return Endpoints (PostgreSQL) ===
  // Check sync status (compare API vs DB)
  fastify.get('/sales-returns/check-sync', salesReturnController.checkSyncStatus);
  
  // Sync sales returns from Accurate API to PostgreSQL
  fastify.post('/sales-returns/sync', salesReturnController.syncFromAccurate);
  
  // Get sales returns from database
  fastify.get('/sales-returns', salesReturnController.getReturns);
  
  // Get return detail by ID
  fastify.get('/sales-returns/:id', salesReturnController.getReturnById);
  
  // Get summary statistics
  fastify.get('/sales-returns/summary/stats', salesReturnController.getSummary);

  // === Purchase Order Endpoints (PostgreSQL) ===
  // Check sync status (compare API vs DB)
  fastify.get('/purchase-orders/check-sync', purchaseOrderController.checkSyncStatus);

  // Sync purchase orders from Accurate API to PostgreSQL
  fastify.post('/purchase-orders/sync', purchaseOrderController.syncFromAccurate);

  // Get purchase orders from database
  fastify.get('/purchase-orders', purchaseOrderController.getOrders);

  // Get purchase order detail by ID
  fastify.get('/purchase-orders/:id', purchaseOrderController.getOrderById);

  // Get summary statistics
  fastify.get('/purchase-orders/summary/stats', purchaseOrderController.getSummary);

  // === Purchase Invoice Endpoints (PostgreSQL) ===
  
  // Check sync status (compare API vs DB)
  fastify.get('/purchase-invoices/check-sync', purchaseInvoiceController.checkSyncStatus);
  
  // Smart sync: Only sync new + updated invoices
  fastify.post('/purchase-invoices/sync-smart', purchaseInvoiceController.syncSmart);
  
  // Count invoices without fetching (dry-run)
  fastify.get('/purchase-invoices/count', purchaseInvoiceController.countInvoices);
  
  // Sync purchase invoices from Accurate API to PostgreSQL
  fastify.post('/purchase-invoices/sync', purchaseInvoiceController.syncFromAccurate);
  
  // Get purchase invoices from database
  fastify.get('/purchase-invoices', purchaseInvoiceController.getInvoices);
  
  // Get invoice detail by ID
  fastify.get('/purchase-invoices/:id', purchaseInvoiceController.getInvoiceById);
  
  // Get summary statistics
  fastify.get('/purchase-invoices/summary/stats', purchaseInvoiceController.getSummary);


}

module.exports = routes;
