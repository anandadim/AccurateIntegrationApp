const db = require('../config/database');
const accurateService = require('../services/accurateService');
const salesInvoiceModel = require('../models/salesInvoiceModel');
const salesInvoiceRelationsModel = require('../models/salesInvoiceRelationsModel');

// Helper: Create date filter for Accurate API
// Format: filter.{field}.val as array [fromDate, toDate]
// Axios will convert to: filter.{field}.val=fromDate&filter.{field}.val=toDate
const createDateFilter = (dateFilterType, fromDate, toDate, includeOutstanding = true) => {
  const filterKey = `filter.${dateFilterType}`;
  const filters = {
    [`${filterKey}.op`]: 'BETWEEN',  // Operator
    [`${filterKey}.val`]: [fromDate, toDate]  // Array for multiple values
  };
  
  // Add outstanding filter if requested
  // if (!includeOutstanding) {
  //   filters['filter.outstanding'] = false;
  // }
  
  return filters;
};

const salesInvoiceController = {
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
      
      // Include outstanding=false to match Postman behavior
      const filters = createDateFilter(dateFilterType, fromDate, toDate, false);

      console.log(`🔍 Checking sync status for ${branch.name}...`);
      console.log(`📅 Date Filter:`, {
        filterType: dateFilterType,
        from: fromDate,
        to: toDate
      });
      console.log(`🔧 API Filters:`, filters);

      // 1. Fetch list from Accurate API (all pages)
      const apiResult = await accurateService.fetchListOnly('sales-invoice', branch.dbId, filters, branchId);
      
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
          const pageResult = await accurateService.fetchListOnly('sales-invoice', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📊 API: ${allApiItems.length} invoices`);

      // 2. Get existing from database
      const dbInvoices = await salesInvoiceModel.getExistingForSync(
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

  // Count sales invoices without fetching details (dry-run)
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
      
      // Include outstanding=false to match Postman behavior
      const filters = createDateFilter(dateFilterType, fromDate, toDate, false);

      // Fetch only first page to get rowCount
      const response = await accurateService.fetchDataWithFilter(
        'sales-invoice/list',
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

  // Sync sales invoices from Accurate API (IMPROVED with streaming)
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
        streamInsert = 'true' // New: insert per batch instead of waiting all
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
          'sales-invoice',
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
            return await this._saveBatch(batchDetails, branchId, branch.name);
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
        'sales-invoice',
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

      const saveResult = await this._saveBatch(result.items, branchId, branch.name);
      
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
          const [day, month, year] = dateStr.split('/');
          return `${year}-${month}-${day}`;
        };
        
        const headerData = {
          invoice_id: invoiceData.id,
          invoice_number: invoiceData.number,
          branch_id: branchId,
          branch_name: branchName,
          trans_date: convertDate(invoiceData.transDate),
          customer_id: invoiceData.customer?.customerNo || null,
          customer_name: invoiceData.customer?.name || null,
          salesman_id: invoiceData.masterSalesmanId || null,
          salesman_name: invoiceData.masterSalesmanName || null,
          warehouse_id: null,
          warehouse_name: null,
          subtotal: invoiceData.subTotal || 0,
          discount: invoiceData.cashDiscount || 0,
          tax: invoiceData.tax1Amount || 0,
          total: invoiceData.totalAmount || 0,
          payment_status: invoiceData.status || null,
          due_date: convertDate(invoiceData.dueDate),
          remaining_amount: invoiceData.remainingAmount || 0,
          raw_data: invoiceData
        };

        const items = (invoiceData.detailItem || []).map(detail => ({
          item_no: detail.item?.no || 'N/A',
          item_name: detail.item?.name || '',
          quantity: detail.quantity || 0,
          unit_name: detail.itemUnit?.name || '',
          unit_price: detail.unitPrice || 0,
          discount: detail.itemCashDiscount || 0,
          amount: detail.salesAmountBase || detail.totalPrice || 0,
          warehouse_name: detail.warehouse?.name || null,
          salesman_name: detail.salesmanName || detail.salesmanList?.[0]?.name || null,
          item_category: detail.item?.itemCategoryId || null
        }));

        await salesInvoiceModel.create(headerData, items);

        // Build relations data (one per receipt history entry)
        const relations = [];
        const receiptHist = invoiceData.receiptHistory || [];
        for (const rh of receiptHist) {
          relations.push({
            branch_id: branchId,
            branch_name: branchName,
            order_number: (invoiceData.detailItem?.[0]?.salesOrder?.number) || null,
            order_id: (invoiceData.detailItem?.[0]?.salesOrderId) || null,
            invoice_number: invoiceData.number,
            invoice_id: invoiceData.id,
            trans_date: convertDate(invoiceData.transDate),
            sales_receipt: rh.historyNumber,
            receipt_date: convertDate(rh.historyDate),
            payment_id: rh.historyPaymentId,
            payment_name: rh.historyPaymentName
          });
        }
        if (relations.length) {
          await salesInvoiceRelationsModel.bulkUpsert(relations);
        }
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

  // Smart sync: Only sync new + updated invoices
  async syncSmart(request, reply) {
    const startTime = Date.now();
    
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'createdDate',
        batchSize = 50,
        batchDelay = 300,
        mode = 'missing' // 'missing' or 'all'
      } = request.query;

      // Convert to numbers
      const parsedBatchSize = parseInt(batchSize) || 50;
      const parsedBatchDelay = parseInt(batchDelay) || 300;

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
      console.log(`🚀 SMART SYNC STARTED: ${branch.name}`);
      console.log(`📅 Date Range: ${dateFrom || today} to ${dateTo || today}`);
      console.log(`⚙️  Mode: ${mode === 'missing' ? 'Missing Only' : 'All'}`);
      console.log(`${'='.repeat(60)}\n`);

      // 1. Check sync status first
      const checkRequest = { query: { branchId, dateFrom, dateTo, dateFilterType } };
      const checkReply = { send: (data) => data, code: () => checkReply };
      const checkResult = await salesInvoiceController.checkSyncStatus(checkRequest, checkReply);

      if (!checkResult.success) {
        return reply.code(500).send({ error: 'Failed to check sync status' });
      }

      console.log(`📊 Sync Status:`);
      console.log(`   - Total in API: ${checkResult.summary.total}`);
      console.log(`   - New: ${checkResult.summary.new}`);
      console.log(`   - Updated: ${checkResult.summary.updated}`);
      console.log(`   - Unchanged: ${checkResult.summary.unchanged}`);
      console.log(`   - Need Sync: ${checkResult.summary.needSync}\n`);

      // 2. Determine which invoices to sync
      let invoiceIdsToSync = [];
      
      if (mode === 'missing') {
        // Sync only new + updated
        // Note: checkResult.invoices only has first 20, need to get full list
        // We'll use the categorization from checkResult but fetch full list
        
        // Get full list from API
        const formatDateForAccurate = (dateStr) => {
          if (!dateStr) return null;
          const [year, month, day] = dateStr.split('-');
          return `${day}/${month}/${year}`;
        };
        
        const fromDate = formatDateForAccurate(dateFrom || today);
        const toDate = formatDateForAccurate(dateTo || today);
        
        const filters = createDateFilter(dateFilterType, fromDate, toDate, false);
        
        console.log(`📋 Fetching full list to get all IDs...`);
        const apiResult = await accurateService.fetchListOnly('sales-invoice', branch.dbId, filters, branchId);
        let allApiItems = [...apiResult.items];
        
        const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
        if (totalPages > 1) {
          for (let page = 2; page <= totalPages; page++) {
            const pageFilters = { ...filters, 'sp.page': page };
            const pageResult = await accurateService.fetchListOnly('sales-invoice', branch.dbId, pageFilters, branchId);
            allApiItems = allApiItems.concat(pageResult.items);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        // Get existing from database
        const dbInvoices = await salesInvoiceModel.getExistingForSync(branchId, dateFrom || today, dateTo || today);
        const dbMap = new Map(dbInvoices.map(inv => [inv.invoice_id, inv]));
        
        // Filter only new + updated
        for (const apiInv of allApiItems) {
          const dbInv = dbMap.get(apiInv.id);
          
          if (!dbInv) {
            // New
            invoiceIdsToSync.push(apiInv.id);
          } else {
            // Check if updated
            const apiOptLock = parseInt(apiInv.optLock || 0);
            const dbOptLock = parseInt(dbInv.opt_lock || 0);
            
            if (apiOptLock > dbOptLock) {
              // Updated
              invoiceIdsToSync.push(apiInv.id);
            }
          }
        }
        
        console.log(`⚡ Syncing missing only: ${invoiceIdsToSync.length} invoices (${checkResult.summary.new} new + ${checkResult.summary.updated} updated)\n`);
      } else {
        // Sync all (re-sync everything)
        // Need to fetch full list again
        const formatDateForAccurate = (dateStr) => {
          if (!dateStr) return null;
          const [year, month, day] = dateStr.split('-');
          return `${day}/${month}/${year}`;
        };
        
        const fromDate = formatDateForAccurate(dateFrom || today);
        const toDate = formatDateForAccurate(dateTo || today);
        
        // Include outstanding=false to match Postman behavior
        const filters = createDateFilter(dateFilterType, fromDate, toDate, false);

        const apiResult = await accurateService.fetchListOnly('sales-invoice', branch.dbId, filters, branchId);
        let allApiItems = [...apiResult.items];
        
        const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
        
        // Safety: Limit max pages
        const MAX_PAGES = 100;
        let pagesToFetch = totalPages;
        
        if (totalPages > MAX_PAGES) {
          console.warn(`⚠️  Too many pages (${totalPages})! Limiting to ${MAX_PAGES} pages.`);
          pagesToFetch = MAX_PAGES;
        }
        
        if (pagesToFetch > 1) {
          for (let page = 2; page <= pagesToFetch; page++) {
            const pageFilters = { ...filters, 'sp.page': page };
            const pageResult = await accurateService.fetchListOnly('sales-invoice', branch.dbId, pageFilters, branchId);
            allApiItems = allApiItems.concat(pageResult.items);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        
        invoiceIdsToSync = allApiItems.map(inv => inv.id);
        console.log(`🔄 Re-syncing all: ${invoiceIdsToSync.length} invoices\n`);
      }

      if (invoiceIdsToSync.length === 0) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Nothing to sync! All data is up-to-date.\n`);
        
        return reply.send({
          success: true,
          message: 'All data is up-to-date',
          summary: {
            branch: branch.name,
            dateRange: { from: dateFrom || today, to: dateTo || today },
            totalChecked: checkResult.summary.total,
            synced: 0,
            skipped: checkResult.summary.unchanged,
            duration: `${duration}s`
          }
        });
      }

      // 3. Fetch details and save (in batches)
      let savedCount = 0;
      let errorCount = 0;
      let fetchErrorCount = 0;
      const totalBatches = Math.ceil(invoiceIdsToSync.length / parsedBatchSize);

      // Helper: Fetch with retry for transient errors
      const fetchWithRetry = async (id, maxRetries = 2) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await accurateService.fetchDetail('sales-invoice', id, branch.dbId, branchId);
            
            // Validate response structure
            if (!response || !response.d || !response.d.id) {
              // Check if it's a transient error (JDBC connection)
              if (response && response.s === false && response.d && 
                  Array.isArray(response.d) && response.d[0]?.includes('Unable to acquire JDBC Connection')) {
                if (attempt < maxRetries) {
                  console.log(`   ├─ 🔄 Retry ${attempt}/${maxRetries} for ID ${id} (JDBC error)`);
                  await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                  continue;
                }
              }
              return { error: true, id: id, message: 'Invalid response structure', response: JSON.stringify(response).substring(0, 100) };
            }
            
            return response; // Success
          } catch (err) {
            // Check if it's a 502 error (server overload)
            const is502 = err.message?.includes('502 Bad Gateway');
            const isTimeout = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
            
            if ((is502 || isTimeout) && attempt < maxRetries) {
              console.log(`   ├─ 🔄 Retry ${attempt}/${maxRetries} for ID ${id} (${is502 ? '502' : 'timeout'})`);
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt)); // Longer wait for 502
              continue;
            }
            
            return { error: true, id: id, message: err.message };
          }
        }
        
        return { error: true, id: id, message: 'Max retries exceeded' };
      };

      for (let i = 0; i < invoiceIdsToSync.length; i += parsedBatchSize) {
        const batch = invoiceIdsToSync.slice(i, i + parsedBatchSize);
        const batchNum = Math.floor(i / parsedBatchSize) + 1;
        
        console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} items)`);
        console.log(`   ├─ Fetching details with retry...`);
        
        const batchPromises = batch.map(id => fetchWithRetry(id, 2));
        const batchDetails = await Promise.all(batchPromises);
        
        // Separate success and errors
        const successDetails = batchDetails.filter(d => !d.error);
        const failedDetails = batchDetails.filter(d => d.error);
        
        fetchErrorCount += failedDetails.length;
        
        console.log(`   ├─ Fetched: ${successDetails.length}/${batch.length} (${failedDetails.length} fetch errors)`);
        
        if (successDetails.length > 0) {
          console.log(`   └─ Saving ${successDetails.length} invoices to database...`);
          
          // Save this batch
          const saveResult = await salesInvoiceController._saveBatch(successDetails, branchId, branch.name);
          savedCount += saveResult.savedCount;
          errorCount += saveResult.errorCount;
          
          console.log(`   ✅ Batch ${batchNum} done: ${saveResult.savedCount} saved, ${saveResult.errorCount} save errors\n`);
        } else {
          console.log(`   ⚠️  Batch ${batchNum} skipped: No valid data to save\n`);
        }
        
        // Delay between batches
        if (i + parsedBatchSize < invoiceIdsToSync.length) {
          await new Promise(resolve => setTimeout(resolve, parsedBatchDelay));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const totalErrors = fetchErrorCount + errorCount;
      
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ SMART SYNC COMPLETED: ${branch.name}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`📊 Results:`);
      console.log(`   - Synced: ${savedCount}`);
      console.log(`   - Fetch Errors: ${fetchErrorCount}`);
      console.log(`   - Save Errors: ${errorCount}`);
      console.log(`   - Total Errors: ${totalErrors}`);
      console.log(`   - Skipped (unchanged): ${checkResult.summary.unchanged}`);
      console.log(`${'='.repeat(60)}\n`);

      return reply.send({
        success: true,
        message: `Smart sync completed for ${branch.name}`,
        summary: {
          branch: branch.name,
          dateRange: { from: dateFrom || today, to: dateTo || today },
          mode: mode,
          checked: {
            total: checkResult.summary.total,
            new: checkResult.summary.new,
            updated: checkResult.summary.updated,
            unchanged: checkResult.summary.unchanged
          },
          synced: savedCount,
          fetchErrors: fetchErrorCount,
          saveErrors: errorCount,
          totalErrors: totalErrors,
          skipped: checkResult.summary.unchanged,
          duration: `${duration}s`
        }
      });
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`\n❌ SMART SYNC FAILED after ${duration}s:`, error.message);
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
  },

  // Check relations status (new/updated/unchanged)
  async checkRelationsStatus(request, reply) {
    const startTime = Date.now();
    
    try {
      const { branchId, dateFrom, dateTo } = request.query;

      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }

      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      const today = new Date().toISOString().split('T')[0];

      // Query invoices with receiptHistory from raw_data
      const query = `
        SELECT 
          id,
          invoice_id,
          invoice_number,
          branch_id,
          branch_name,
          trans_date,
          raw_data
        FROM sales_invoices
        WHERE branch_id = $1
          AND trans_date BETWEEN $2 AND $3
          AND raw_data->'receiptHistory' IS NOT NULL
          AND raw_data->'receiptHistory' != '[]'::jsonb
        ORDER BY trans_date DESC
      `;

      const result = await db.query(query, [branchId, dateFrom || today, dateTo || today]);
      const invoices = result.rows;

      // Extract relations from raw_data
      const incomingRelations = [];
      
      for (const invoice of invoices) {
        const rawData = invoice.raw_data;
        const receiptHistory = rawData.receiptHistory || [];

        if (receiptHistory.length === 0) continue;

        const soNumber = rawData.detailItem?.[0]?.salesOrder?.number || null;
        const soId = rawData.detailItem?.[0]?.salesOrderId || null;

        for (const rh of receiptHistory) {
          const convertDate = (dateStr) => {
            if (!dateStr) return null;
            const [day, month, year] = dateStr.split('/');
            return `${year}-${month}-${day}`;
          };

          incomingRelations.push({
            branch_id: branchId,
            branch_name: branch.name,
            order_number: soNumber,
            order_id: soId,
            invoice_number: invoice.invoice_number,
            invoice_id: invoice.invoice_id,
            trans_date: invoice.trans_date,
            sales_receipt: rh.historyNumber,
            receipt_date: convertDate(rh.historyDate),
            payment_id: rh.historyPaymentId,
            payment_name: rh.historyPaymentName
          });
        }
      }

      // Check status
      const statusResult = await salesInvoiceRelationsModel.checkStatus(
        incomingRelations,
        branchId,
        dateFrom || today,
        dateTo || today
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return reply.send({
        success: true,
        summary: statusResult.summary,
        invoices: {
          new: statusResult.new.slice(0, 20),
          updated: statusResult.updated.slice(0, 20),
          unchanged: statusResult.unchanged.slice(0, 20),
          hasMore: {
            new: statusResult.new.length > 20,
            updated: statusResult.updated.length > 20,
            unchanged: statusResult.unchanged.length > 20
          }
        },
        duration: `${duration}s`
      });
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`\n❌ CHECK RELATIONS STATUS FAILED after ${duration}s:`, error.message);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Extract relations from existing raw_data in database
  async extractRelationsFromDB(request, reply) {
    const startTime = Date.now();
    
    try {
      const { branchId, dateFrom, dateTo } = request.query;

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
      console.log(`🔄 EXTRACT RELATIONS STARTED: ${branch.name}`);
      console.log(`📅 Date Range: ${dateFrom || today} to ${dateTo || today}`);
      console.log(`${'='.repeat(60)}\n`);

      // 1. Query invoices with receiptHistory from raw_data
      const query = `
        SELECT 
          id,
          invoice_id,
          invoice_number,
          branch_id,
          branch_name,
          trans_date,
          raw_data
        FROM sales_invoices
        WHERE branch_id = $1
          AND trans_date BETWEEN $2 AND $3
          AND raw_data->'receiptHistory' IS NOT NULL
          AND raw_data->'receiptHistory' != '[]'::jsonb
        ORDER BY trans_date DESC
      `;

      const result = await db.query(query, [branchId, dateFrom || today, dateTo || today]);
      const invoices = result.rows;

      console.log(`📊 Found ${invoices.length} invoices with receipt history`);

      if (invoices.length === 0) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        return reply.send({
          success: true,
          message: 'No invoices with receipt history found',
          summary: {
            branch: branch.name,
            dateRange: { from: dateFrom || today, to: dateTo || today },
            extracted: 0,
            duration: `${duration}s`
          }
        });
      }

      // 2. Extract relations from raw_data
      let totalRelations = 0;
      let extractedCount = 0;
      let errorCount = 0;

      for (const invoice of invoices) {
        try {
          const rawData = invoice.raw_data;
          const receiptHistory = rawData.receiptHistory || [];

          if (receiptHistory.length === 0) continue;

          const relations = [];
          const soNumber = rawData.detailItem?.[0]?.salesOrder?.number || null;
          const soId = rawData.detailItem?.[0]?.salesOrderId || null;

          for (const rh of receiptHistory) {
            const convertDate = (dateStr) => {
              if (!dateStr) return null;
              const [day, month, year] = dateStr.split('/');
              return `${year}-${month}-${day}`;
            };

            relations.push({
              branch_id: branchId,
              branch_name: branch.name,
              order_number: soNumber,
              order_id: soId,
              invoice_number: invoice.invoice_number,
              invoice_id: invoice.invoice_id,
              trans_date: invoice.trans_date,
              sales_receipt: rh.historyNumber,
              receipt_date: convertDate(rh.historyDate),
              payment_id: rh.historyPaymentId,
              payment_name: rh.historyPaymentName
            });
          }

          if (relations.length > 0) {
            await salesInvoiceRelationsModel.bulkUpsert(relations);
            totalRelations += relations.length;
            extractedCount++;
          }

          if (extractedCount % 10 === 0) {
            process.stdout.write(`💾 Processed: ${extractedCount}/${invoices.length}\r`);
          }
        } catch (err) {
          console.error(`❌ Error extracting relations for invoice ${invoice.invoice_number}:`, err.message);
          errorCount++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ EXTRACT RELATIONS COMPLETED: ${branch.name}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`📊 Results:`);
      console.log(`   - Invoices Processed: ${extractedCount}`);
      console.log(`   - Relations Extracted: ${totalRelations}`);
      console.log(`   - Errors: ${errorCount}`);
      console.log(`${'='.repeat(60)}\n`);

      return reply.send({
        success: true,
        message: `Extracted ${totalRelations} relations from ${extractedCount} invoices`,
        summary: {
          branch: branch.name,
          dateRange: { from: dateFrom || today, to: dateTo || today },
          invoicesProcessed: extractedCount,
          relationsExtracted: totalRelations,
          errors: errorCount,
          duration: `${duration}s`
        }
      });
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`\n❌ EXTRACT RELATIONS FAILED after ${duration}s:`, error.message);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Get relations from database
  async getRelations(request, reply) {
    try {
      const { branchId, dateFrom, dateTo, limit = 1000, offset = 0 } = request.query;

      const filters = {
        branch_id: branchId,
        date_from: dateFrom,
        date_to: dateTo
      };

      const relations = await salesInvoiceRelationsModel.list(filters);

      return reply.send({
        success: true,
        count: relations.length,
        data: relations
      });
    } catch (error) {
      console.error('Error in getRelations:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Helper: Convert date format DD/MM/YYYY to YYYY-MM-DD
  _convertDate(dateStr) {
    if (!dateStr) return null;
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  }
};

module.exports = salesInvoiceController;
