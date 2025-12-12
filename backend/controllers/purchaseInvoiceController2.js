const accurateService = require('../services/accurateService');
const purchaseInvoiceModel = require('../models/purchaseInvoiceModel');

// Helper: Create date filter for Accurate API
// Format: filter.{field}.val as array [fromDate, toDate]
// Axios will convert to: filter.{field}.val=fromDate&filter.{field}.val=toDate
const createDateFilter = (dateFilterType, fromDate, toDate, includeOutstanding = true) => {
  const filterKey = `filter.${dateFilterType}`;
  const filters = {
    [`${filterKey}.op`]: 'BETWEEN',  // Operator
    [`${filterKey}.val`]: [fromDate, toDate]  // Array for multiple values
  };
  
  return filters;
};

const purchaseInvoiceController = {
  // Check sync status (compare API vs Database)
  async checkSyncStatus(request, reply) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'createdDate'
      } = request.query;

      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }

      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      const today = new Date().toISOString().split('T')[0];
      
      const formatDateForAccurate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };
      
      const fromDate = formatDateForAccurate(dateFrom || today);
      const toDate = formatDateForAccurate(dateTo || today);
      
      const filters = createDateFilter(dateFilterType, fromDate, toDate, false);

      console.log(`🔍 Checking sync status for ${branch.name}...`);
      console.log(`📅 Date Filter:`, {
        filterType: dateFilterType,
        from: fromDate,
        to: toDate
      });
      console.log(`🔧 API Filters:`, filters);

      // 1. Fetch list from Accurate API (all pages)
      const apiResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, filters, branchId);
      
      // Debug: Log pagination info
      console.log(`📊 API Pagination:`, {
        rowCount: apiResult.pagination.rowCount,
        pageSize: apiResult.pagination.pageSize,
        currentPage: apiResult.pagination.page || 1
      });
      
      // Fetch all pages if needed
      let allApiItems = [...apiResult.items];
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      
      console.log(`📄 Calculated: ${totalPages} total pages (${apiResult.pagination.rowCount} rows ÷ ${apiResult.pagination.pageSize} per page)`);
      
      // Safety: Limit max pages to avoid excessive API calls
      const MAX_PAGES = 100; // Max 100 pages = 100,000 invoices
      let pagesToFetch = totalPages;
      
      if (totalPages > MAX_PAGES) {
        console.warn(`⚠️  Too many pages (${totalPages})! Limiting to ${MAX_PAGES} pages for safety.`);
        console.warn(`⚠️  This will fetch ${MAX_PAGES * apiResult.pagination.pageSize} out of ${apiResult.pagination.rowCount} invoices.`);
        console.warn(`⚠️  Consider using smaller date range or contact admin.`);
        pagesToFetch = MAX_PAGES;
      }
      
      if (pagesToFetch > 1) {
        console.log(`📄 Fetching ${pagesToFetch - 1} more pages...`);
        for (let page = 2; page <= pagesToFetch; page++) {
          const pageFilters = { ...filters, 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📊 API: ${allApiItems.length} invoices`);

      // 2. Get existing from database
      const dbInvoices = await purchaseInvoiceModel.getExistingForSync(
        branchId,
        dateFrom || today,
        dateTo || today
      );

      console.log(`💾 DB: ${dbInvoices.length} invoices`);

      // 3. Create lookup map
      const dbMap = new Map(dbInvoices.map(inv => [inv.invoice_id, inv]));

      // 4. Categorize
      const newInvoices = [];
      const updatedInvoices = [];
      const unchangedInvoices = [];

      for (const apiInv of allApiItems) {
        const dbInv = dbMap.get(apiInv.id);

        if (!dbInv) {
          // Not in DB → New
          newInvoices.push({
            id: apiInv.id,
            number: apiInv.number,
            optLock: apiInv.optLock
          });
        } else {
          // In DB → Check optLock
          const apiOptLock = parseInt(apiInv.optLock || 0);
          const dbOptLock = parseInt(dbInv.opt_lock || 0);

          if (apiOptLock > dbOptLock) {
            // Modified in Accurate → Updated
            updatedInvoices.push({
              id: apiInv.id,
              number: apiInv.number,
              optLock: apiInv.optLock,
              dbOptLock: dbInv.opt_lock
            });
          } else {
            // Same → Unchanged
            unchangedInvoices.push({
              id: apiInv.id,
              number: apiInv.number
            });
          }
        }
      }

      const needSync = newInvoices.length + updatedInvoices.length;

      console.log(`✅ Check complete: ${newInvoices.length} new, ${updatedInvoices.length} updated, ${unchangedInvoices.length} unchanged`);

      return reply.send({
        success: true,
        branch: {
          id: branch.id,
          name: branch.name,
          dbId: branch.dbId
        },
        dateRange: {
          from: dateFrom || today,
          to: dateTo || today,
          filterType: dateFilterType
        },
        summary: {
          total: allApiItems.length,
          new: newInvoices.length,
          updated: updatedInvoices.length,
          unchanged: unchangedInvoices.length,
          needSync: needSync,
          inDatabase: dbInvoices.length
        },
        invoices: {
          new: newInvoices.slice(0, 20),  // Limit to 20 for display
          updated: updatedInvoices.slice(0, 20),
          hasMore: {
            new: newInvoices.length > 20,
            updated: updatedInvoices.length > 20
          }
        },
        recommendation: needSync === 0 ? 'up_to_date' : 'sync_needed'
      });
    } catch (error) {
      console.error('Error in checkSyncStatus:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Count purchase invoices without fetching details (dry-run)
  async countInvoices(request, reply) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'createdDate'
      } = request.query;

      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }

      // Get branch info
      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      console.log(`Counting invoices for ${branch.name}...`);

      // Setup date filter
      const today = new Date().toISOString().split('T')[0];
      
      const formatDateForAccurate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };
      
      const fromDate = formatDateForAccurate(dateFrom || today);
      const toDate = formatDateForAccurate(dateTo || today);
      
      const filters = createDateFilter(dateFilterType, fromDate, toDate, false);

      // Fetch only first page to get rowCount
      const response = await accurateService.fetchDataWithFilter(
        'purchase-invoice/list',
        branch.dbId,
        filters,
        branchId
      );

      if (!response.s || !response.sp) {
        return reply.code(500).send({ error: 'Invalid response from Accurate API' });
      }

      const totalRows = response.sp.rowCount;
      const pageSize = response.sp.pageSize || 1000;
      const totalPages = Math.ceil(totalRows / pageSize);

      return reply.send({
        success: true,
        branch: {
          id: branch.id,
          name: branch.name,
          dbId: branch.dbId
        },
        dateRange: {
          from: dateFrom || today,
          to: dateTo || today,
          filterType: dateFilterType
        },
        count: {
          totalInvoices: totalRows,
          pageSize: pageSize,
          totalPages: totalPages,
          estimatedApiCalls: totalRows, // 1 call per invoice for details
          estimatedTime: `~${Math.ceil(totalRows / 50 * 0.3)} seconds` // batch 50, delay 300ms
        }
      });
    } catch (error) {
      console.error('Error in countInvoices:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Sync purchase invoices from Accurate API
  async syncFromAccurate(request, reply) {
    const startTime = Date.now();
    
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        maxItems, 
        dateFilterType = 'createdDate',
        batchSize = 50,
        batchDelay = 300,
        streamInsert = 'true'
      } = request.query;

      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }

      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      const today = new Date().toISOString().split('T')[0];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 SYNC STARTED: ${branch.name}`);
      console.log(`📅 Date Range: ${dateFrom || today} to ${dateTo || today}`);
      console.log(`⚙️  Batch Size: ${batchSize}, Delay: ${batchDelay}ms`);
      console.log(`${'='.repeat(60)}\n`);

      // Use streaming service if enabled
      if (streamInsert === 'true') {
        const result = await accurateService.fetchAndStreamInsert(
          'purchase-invoice',
          branch.dbId,
          { 
            maxItems, 
            dateFrom, 
            dateTo, 
            dateFilterType,
            batchSize: parseInt(batchSize),
            batchDelay: parseInt(batchDelay)
          },
          branchId,
          branch.name,
          // Callback for each batch
          async (batchDetails) => {
            return await purchaseInvoiceController._saveBatch(batchDetails, branchId, branch.name);
          }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        console.log(`\n${'='.repeat(60)}`);
        console.log(`✅ SYNC COMPLETED: ${branch.name}`);
        console.log(`⏱️  Duration: ${duration}s`);
        console.log(`📊 Saved: ${result.savedCount}, Errors: ${result.errorCount}`);
        console.log(`${'='.repeat(60)}\n`);

        return reply.send({
          success: true,
          message: `Synced ${result.savedCount} invoices from ${branch.name}`,
          summary: {
            branch: branch.name,
            dateRange: { from: dateFrom || today, to: dateTo || today },
            totalFetched: result.totalFetched,
            saved: result.savedCount,
            errors: result.errorCount,
            duration: `${duration}s`
          }
        });
      }

      // Fallback to old method (fetch all then insert)
      const result = await accurateService.fetchListWithDetails(
        'purchase-invoice',
        branch.dbId,
        { 
          maxItems, 
          dateFrom, 
          dateTo, 
          dateFilterType,
          batchSize: parseInt(batchSize),
          batchDelay: parseInt(batchDelay)
        },
        branchId
      );

      if (!result.success) {
        return reply.code(500).send({ error: 'Failed to fetch from Accurate API' });
      }

      const saveResult = await purchaseInvoiceController._saveBatch(result.items, branchId, branch.name);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ SYNC COMPLETED: ${branch.name}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`📊 Saved: ${saveResult.savedCount}, Errors: ${saveResult.errorCount}`);
      console.log(`${'='.repeat(60)}\n`);

      return reply.send({
        success: true,
        message: `Synced ${saveResult.savedCount} invoices from ${branch.name}`,
        summary: {
          branch: branch.name,
          fetched: result.items.length,
          saved: saveResult.savedCount,
          errors: saveResult.errorCount,
          apiErrors: result.errors?.length || 0,
          duration: `${duration}s`
        }
      });
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`\n❌ SYNC FAILED after ${duration}s:`, error.message);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Helper: Save batch of invoices to database
  async _saveBatch(items, branchId, branchName) {
    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const item of items) {
      try {
        const invoiceData = item.d || item;
        
        if (!invoiceData || !invoiceData.id) {
          const errorMsg = `Skipping item with no ID. Item structure: ${JSON.stringify(item).substring(0, 200)}`;
          console.warn(`⚠️  ${errorMsg}`);
          errors.push({ invoice: 'unknown', error: errorMsg });
          errorCount++;
          continue;
        }
        
        const convertDate = (dateStr) => {
          if (!dateStr) return null;
          
          // Handle format "22 Nov 2025"
          if (dateStr.includes(' ')) {
            const parts = dateStr.split(' ');
            if (parts.length === 3) {
              const [day, month, year] = parts;
              const monthMap = {
                'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
              };
              const monthNum = monthMap[month] || month;
              return `${year}-${monthNum}-${day.padStart(2, '0')}`;
            }
          }
          
          // Handle format "DD/MM/YYYY"
          if (dateStr.includes('/')) {
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }
          
          // Handle format "YYYY-MM-DD" (already correct)
          if (dateStr.includes('-') && dateStr.length === 10) {
            return dateStr;
          }
          
          // Fallback: try to parse with Date
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
          
          console.warn(`⚠️  Unable to parse date: ${dateStr}`);
          return null;
        };
        
        // Calculate age (days between created_date and today)
        const calculateAge = (dateStr) => {
          if (!dateStr) return null;
          const date = new Date(convertDate(dateStr));
          const today = new Date();
          const diffTime = Math.abs(today - date);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return diffDays;
        };
        
        const headerData = {
          invoice_id: invoiceData.id,
          invoice_number: invoiceData.number,
          branch_id: branchId,
          branch_name: branchName,
          trans_date: convertDate(invoiceData.transDate),
          created_date: convertDate(invoiceData.transDateView || invoiceData.createdDate),
          vendor_no: invoiceData.vendor?.vendorNo || null,
          vendor_name: invoiceData.vendor?.name || null,
          bill_number: invoiceData.billNumber || null,
          age: calculateAge(invoiceData.transDateView || invoiceData.createdDate),
          warehouse_id: null,
          warehouse_name: null,
          subtotal: invoiceData.subTotal || 0,
          discount: invoiceData.cashDiscount || 0,
          tax: invoiceData.tax1Amount || 0,
          total: invoiceData.totalAmount || 0,
          status_name: invoiceData.statusName || null,
          created_by: invoiceData.createdBy || null,
          raw_data: invoiceData
        };

        const items = (invoiceData.detailItem || []).map(detail => ({
          item_no: detail.item?.no || 'N/A',
          item_name: detail.item?.name || '',
          quantity: detail.quantity || 0,
          unit_name: detail.itemUnit?.name || '',
          unit_price: detail.unitPrice || 0,
          discount: detail.itemCashDiscount || 0,
          amount: detail.purchaseAmountBase || detail.totalPrice || 0,
          warehouse_name: detail.warehouse?.name || null,
          item_category: detail.item?.itemCategoryId || null
        }));

        await purchaseInvoiceModel.create(headerData, items);
        savedCount++;
        
        // Progress indicator every 10 invoices
        if (savedCount % 10 === 0) {
          process.stdout.write(`💾 Saved: ${savedCount}\r`);
        }
      } catch (err) {
        const invoiceNum = item.d?.number || item.number || 'unknown';
        console.error(`❌ Error saving invoice ${invoiceNum}:`, err.message);
        errors.push({ invoice: invoiceNum, error: err.message });
        errorCount++;
      }
    }

    // Log error summary if there are errors
    if (errors.length > 0 && errors.length <= 5) {
      console.log(`\n⚠️  Error Details:`);
      errors.forEach(e => console.log(`   - ${e.invoice}: ${e.error}`));
    } else if (errors.length > 5) {
      console.log(`\n⚠️  ${errors.length} errors occurred. First 5:`);
      errors.slice(0, 5).forEach(e => console.log(`   - ${e.invoice}: ${e.error}`));
    }

    return { savedCount, errorCount, errors };
  },

  // Get invoices from database
  async getInvoices(request, reply) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        vendorNo,
        limit = 100,
        offset = 0
      } = request.query;

      const filters = {
        branch_id: branchId,
        date_from: dateFrom,
        date_to: dateTo,
        vendor_no: vendorNo,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const invoices = await purchaseInvoiceModel.list(filters);

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

      const invoice = await purchaseInvoiceModel.getById(id);

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

      const summary = await purchaseInvoiceModel.getSummary(filters);

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

module.exports = purchaseInvoiceController;
