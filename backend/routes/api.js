const accurateController = require('../controllers/accurateController');
const salesInvoiceController = require('../controllers/salesInvoiceController');

async function routes(fastify, options) {
  // Test endpoint
  fastify.get('/test', async (request, reply) => {
    return { message: 'API routes working' };
  });

  // Get branches list
  fastify.get('/branches', accurateController.getBranches);

  // Get database list (untuk pilih cabang)
  fastify.get('/databases', accurateController.getDatabases);

  // Get data dari endpoint tertentu
  fastify.get('/data/:endpoint', accurateController.getData);

  // Get cached data
  fastify.get('/cache/:endpoint', accurateController.getCachedData);

  // Get list with all details
  fastify.get('/details/:endpoint', accurateController.getListWithDetails);

  // === Sales Invoice Endpoints (PostgreSQL) ===
  
  // Sync sales invoices from Accurate API to PostgreSQL
  fastify.post('/sales-invoices/sync', salesInvoiceController.syncFromAccurate);
  
  // Get sales invoices from database
  fastify.get('/sales-invoices', salesInvoiceController.getInvoices);
  
  // Get invoice detail by ID
  fastify.get('/sales-invoices/:id', salesInvoiceController.getInvoiceById);
  
  // Get summary statistics
  fastify.get('/sales-invoices/summary/stats', salesInvoiceController.getSummary);
}

module.exports = routes;
