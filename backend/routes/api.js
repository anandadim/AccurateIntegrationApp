const accurateController = require('../controllers/accurateController');
const salesInvoiceController = require('../controllers/salesInvoiceController');
const salesOrderController = require('../controllers/salesOrderController');
const purchaseInvoiceController = require('../controllers/purchaseInvoiceController');
const itemController = require('../controllers/itemController');
const customerController = require('../controllers/customerController');
const salesReceiptController = require('../controllers/salesReceiptController');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const salesReturnController = require('../controllers/salesReturnController');
const srpController = require('../controllers/srpController');
const accurateSchedulerController = require('../controllers/accurateSchedulerController');
const itemMasterController = require('../controllers/itemMasterController');
const schedulerConfigController = require('../controllers/schedulerConfigController');
const itemMutationsController = require('../controllers/itemMutationsController');


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

  // Check relations status (new/updated/unchanged)
  fastify.get('/sales-invoices/check-relations-status', salesInvoiceController.checkRelationsStatus);

  // Extract relations from existing raw_data in database
  fastify.post('/sales-invoices/extract-relations', salesInvoiceController.extractRelationsFromDB);

  // Get sales invoice relations from database
  fastify.get('/sales-invoice-relations', salesInvoiceController.getRelations);
  
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

  // SNJ Merch Item Enquiry Endpoints

  fastify.get('/srp/branches', srpController.getBranches);
  fastify.post('/srp/branches/reload', srpController.reloadBranches);
  fastify.get('/srp/logs', srpController.getFetchLogs);
  fastify.get('/srp/scheduler/status', srpController.getSchedulerStatus);
  fastify.post('/srp/scheduler/pause', srpController.pauseScheduler);
  fastify.post('/srp/scheduler/resume', srpController.resumeScheduler);
  fastify.post('/srp/scheduler/run-now', srpController.runSchedulerNow);

  // Inventory by location
  fastify.get('/srp/item-enquiry/by-location', srpController.fetchInventoryByLocation);
  fastify.get('/srp/item-enquiry/by-location/all', srpController.fetchInventoryByLocationAll);

  // Inventory by storage location
  fastify.get('/srp/item-enquiry/by-storage-location', srpController.fetchInventoryByStorage);
  fastify.get('/srp/item-enquiry/by-storage-location/all', srpController.fetchInventoryByStorageAll);

  // Sync inventory to database
  fastify.post('/srp/item-enquiry/sync', srpController.syncInventory);

  // Item master sync & query endpoints
  fastify.post('/srp/item-master/sync', srpController.syncItemMaster);
  fastify.get('/srp/item-master', srpController.getItemMasterRecords);

  // Sales detail endpoints
  fastify.get('/srp/sales-detail', srpController.fetchSalesDetail);
  fastify.post('/srp/sales-detail/sync', srpController.syncSalesDetail);

  // === Accurate Scheduler Endpoints ===

  fastify.get('/accurate/scheduler/logs', accurateSchedulerController.getLogs);
  fastify.get('/accurate/scheduler/status', accurateSchedulerController.getStatus);
  fastify.post('/accurate/scheduler/pause', accurateSchedulerController.pause);
  fastify.post('/accurate/scheduler/resume', accurateSchedulerController.resume);
  fastify.post('/accurate/scheduler/run-now', accurateSchedulerController.runNow);

  // === Scheduler Configuration Endpoints ===

  fastify.get('/scheduler/config', schedulerConfigController.getAll);
  fastify.put('/scheduler/config/cron', schedulerConfigController.updateCron);

  // === SRP Item Master Endpoints ===

  fastify.get('/item-master/list', itemMasterController.getList);

  // === Item Mutations Endpoints (PostgreSQL) ===

  // Check sync status (compare API vs DB)
  fastify.get('/item-mutations/check-sync', itemMutationsController.checkSyncStatus);

  // Count mutations without fetching (dry-run)
  fastify.get('/item-mutations/count', itemMutationsController.countMutations);

  // Sync item mutations from Accurate API to PostgreSQL
  fastify.post('/item-mutations/sync', itemMutationsController.syncFromAccurate);

  // Smart sync: Only sync new + updated mutations
  fastify.post('/item-mutations/sync-smart', itemMutationsController.syncSmart);

  // Get item mutations from database
  fastify.get('/item-mutations', itemMutationsController.getMutations);

  // Get mutation detail by ID
  fastify.get('/item-mutations/:id', itemMutationsController.getMutationById);

  // Get summary statistics
  fastify.get('/item-mutations/summary/stats', itemMutationsController.getSummary);


}

module.exports = routes;
