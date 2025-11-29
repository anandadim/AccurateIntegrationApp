const accurateService = require('../services/accurateService');
const salesInvoiceModel = require('../models/salesInvoiceModel');

const salesInvoiceController = {
  // Sync sales invoices from Accurate API
  async syncFromAccurate(request, reply) {
    try {
      const { branchId, dateFrom, dateTo, maxItems = 100 } = request.query;

      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }

      // Get branch info
      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      console.log(`Syncing sales invoices for ${branch.name}...`);

      // Fetch from Accurate API
      const result = await accurateService.fetchListWithDetails(
        'sales-invoice',
        branch.dbId,
        { maxItems, dateFrom, dateTo },
        branchId
      );

      if (!result.success) {
        return reply.code(500).send({ error: 'Failed to fetch from Accurate API' });
      }

      // Save to database
      let savedCount = 0;
      let errorCount = 0;

      for (const item of result.items) {
        try {
          const invoiceData = item.d;
          
          // Convert date from DD/MM/YYYY to YYYY-MM-DD
          const convertDate = (dateStr) => {
            if (!dateStr) return null;
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month}-${day}`;
          };
          
          // Prepare header data
          const headerData = {
            invoice_id: invoiceData.id,
            invoice_number: invoiceData.number,
            branch_id: branchId,
            branch_name: branch.name,
            trans_date: convertDate(invoiceData.transDate),
            customer_id: invoiceData.customerId || null,
            customer_name: invoiceData.customerName || null,
            salesman_id: invoiceData.salesmanId || null,
            salesman_name: invoiceData.salesmanName || null,
            warehouse_id: invoiceData.warehouseId || null,
            warehouse_name: invoiceData.warehouseName || null,
            subtotal: invoiceData.subtotal || 0,
            discount: invoiceData.discount || 0,
            tax: invoiceData.tax || 0,
            total: invoiceData.total || 0,
            raw_data: invoiceData
          };

          // Prepare items data
          const items = (invoiceData.detailItem || []).map(detail => ({
            item_no: detail.item?.no || detail.itemNo || 'N/A',
            item_name: detail.item?.name || detail.itemName || '',
            quantity: detail.quantity || 0,
            unit_name: detail.itemUnit?.name || detail.unitName || '',
            unit_price: detail.unitPrice || 0,
            discount: detail.discount || 0,
            amount: detail.amount || 0
          }));

          await salesInvoiceModel.create(headerData, items);
          savedCount++;
        } catch (err) {
          console.error(`Error saving invoice ${item.d?.number}:`, err.message);
          errorCount++;
        }
      }

      return reply.send({
        success: true,
        message: `Synced ${savedCount} invoices from ${branch.name}`,
        summary: {
          branch: branch.name,
          fetched: result.items.length,
          saved: savedCount,
          errors: errorCount,
          apiErrors: result.errors.length
        }
      });
    } catch (error) {
      console.error('Error in syncFromAccurate:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Get invoices from database
  async getInvoices(request, reply) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        customerId,
        limit = 100,
        offset = 0
      } = request.query;

      const filters = {
        branch_id: branchId,
        date_from: dateFrom,
        date_to: dateTo,
        customer_id: customerId,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const invoices = await salesInvoiceModel.list(filters);

      return reply.send({
        success: true,
        count: invoices.length,
        data: invoices
      });
    } catch (error) {
      console.error('Error in getInvoices:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Get invoice detail by ID
  async getInvoiceById(request, reply) {
    try {
      const { id } = request.params;

      const invoice = await salesInvoiceModel.getById(id);

      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }

      return reply.send({
        success: true,
        data: invoice
      });
    } catch (error) {
      console.error('Error in getInvoiceById:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Get summary statistics
  async getSummary(request, reply) {
    try {
      const { branchId, dateFrom, dateTo } = request.query;

      const filters = {
        branch_id: branchId,
        date_from: dateFrom,
        date_to: dateTo
      };

      const summary = await salesInvoiceModel.getSummary(filters);

      return reply.send({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error in getSummary:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  }
};

module.exports = salesInvoiceController;
