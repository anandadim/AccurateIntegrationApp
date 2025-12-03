const accurateController = require('../controllers/accurateController');
const salesInvoiceController = require('../controllers/salesInvoiceController');
const salesOrderController = require('../controllers/salesOrderController');
const itemController = require('../controllers/itemController');
const customerController = require('../controllers/customerController');

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
}

module.exports = routes;
