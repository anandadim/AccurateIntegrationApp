const accurateService = require('../services/accurateService');
const purchaseInvoiceModel = require('../models/purchaseInvoiceModel');

// Helper: Create date filter for Accurate API
const createDateFilter = (dateFilterType, fromDate, toDate) => {
  const filterKey = `filter.${dateFilterType}`;
  return {
    [`${filterKey}.op`]: 'BETWEEN',
    [`${filterKey}.val`]: [fromDate, toDate]
  };
};

const purchaseInvoiceController = {
  // Check sync status (compare API vs Database)
  async checkSyncStatus(request, reply) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'transDate'
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
      
      const filters = createDateFilter(dateFilterType, fromDate, toDate);

      // 1. Fetch list from Accurate API (all pages)
      const apiResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, filters, branchId);
      
      let allApiItems = [...apiResult.items];
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      
      if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
          const pageFilters = { ...filters, 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // 2. Get existing invoices from database
      const dbInvoices = await purchaseInvoiceModel.getExistingForSync(branchId, dateFrom || today, dateTo || today);
      const dbMap = new Map(dbInvoices.map(inv => [parseInt(inv.invoice_id), inv]));

      // 3. Compare and categorize
      const newInvoices = [];
      const updatedInvoices = [];
      const unchangedInvoices = [];

      for (const apiInv of allApiItems) {
        const dbInv = dbMap.get(parseInt(apiInv.id));
        
        if (!dbInv) {
          newInvoices.push({
            id: apiInv.id,
            number: apiInv.number,
            optLock: apiInv.optLock
          });
        } else {
          const apiOptLock = parseInt(apiInv.optLock || 0);
          const dbOptLock = parseInt(dbInv.opt_lock || 0);

          if (apiOptLock > dbOptLock) {
            updatedInvoices.push({
              id: apiInv.id,
              number: apiInv.number,
              optLock: apiInv.optLock,
              dbOptLock: dbInv.opt_lock
            });
          } else {
            unchangedInvoices.push({
              id: apiInv.id,
              number: apiInv.number
            });
          }
        }
      }

      const needSync = newInvoices.length + updatedInvoices.length;

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
          new: newInvoices.slice(0, 20),
          updated: updatedInvoices.slice(0, 20),
          hasMore: {
            new: newInvoices.length > 20,
            updated: updatedInvoices.length > 20
          }
        }
      });
    } catch (error) {
      console.error('Error in checkSyncStatus:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Count invoices (dry-run)
  async countInvoices(request, reply) {
    try {
      const { branchId, dateFrom, dateTo, dateFilterType = 'transDate' } = request.query;

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
      
      const filters = createDateFilter(dateFilterType, fromDate, toDate);
      const apiResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, filters, branchId);

      return reply.send({
        success: true,
        branch: branch.name,
        dateRange: { from: dateFrom || today, to: dateTo || today },
        count: apiResult.pagination.rowCount,
        pageSize: apiResult.pagination.pageSize,
        totalPages: Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize)
      });
    } catch (error) {
      console.error('Error in countInvoices:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Smart sync: Only sync new + updated invoices
  async syncSmart(request, reply) {
    const startTime = Date.now();
    
    try {
      let { 
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'transDate',
        batchSize = 50,
        batchDelay = 300,
        mode = 'missing'
      } = request.query;

      batchSize = parseInt(batchSize, 10) || 50;
      batchDelay = parseInt(batchDelay, 10) || 300;

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
      console.log(`🚀 SMART SYNC STARTED: ${branch.name} (Purchase Invoice)`);
      console.log(`📅 Date Range: ${dateFrom || today} to ${dateTo || today}`);
      console.log(`⚙️  Mode: ${mode === 'missing' ? 'Missing Only' : 'All'}`);
      console.log(`${'='.repeat(60)}\n`);

      // 1. Get list of all invoices in date range
      const formatDateForAccurate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };
      
      const fromDate = formatDateForAccurate(dateFrom || today);
      const toDate = formatDateForAccurate(dateTo || today);
      
      const filters = {
        [`filter.${dateFilterType}.op`]: 'BETWEEN',
        [`filter.${dateFilterType}.val`]: [fromDate, toDate]
      };

      console.log(`📋 Fetching list from ${fromDate} to ${toDate}...`);
      const apiResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, filters, branchId);
      let allApiItems = [...apiResult.items];
      
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      if (totalPages > 1) {
        console.log(`📄 Fetching ${totalPages - 1} more pages...`);
        for (let page = 2; page <= totalPages; page++) {
          const pageFilters = { ...filters, 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`📊 Total API invoices: ${allApiItems.length}`);

      // 2. Determine which invoices to sync
      let invoiceIdsToSync = [];
      
      if (mode === 'missing') {
        const dbInvoices = await purchaseInvoiceModel.getExistingForSync(branchId, dateFrom || today, dateTo || today);
        const dbMap = new Map(dbInvoices.map(inv => [inv.invoice_id, inv]));
        
        for (const apiInv of allApiItems) {
          const dbInv = dbMap.get(apiInv.id);
          
          if (!dbInv) {
            invoiceIdsToSync.push(apiInv.id);
          } else {
            const apiOptLock = parseInt(apiInv.optLock || 0);
            const dbOptLock = parseInt(dbInv.opt_lock || 0);
            
            if (apiOptLock > dbOptLock) {
              invoiceIdsToSync.push(apiInv.id);
            }
          }
        }
        
        console.log(`⚡ Syncing missing only: ${invoiceIdsToSync.length} invoices\n`);
      } else {
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
            totalChecked: allApiItems.length,
            synced: 0,
            skipped: allApiItems.length - invoiceIdsToSync.length,
            duration: `${duration}s`
          }
        });
      }

      // 3. Fetch details and save (in batches)
      const totalBatches = Math.ceil(invoiceIdsToSync.length / batchSize);
      let savedCount = 0;
      let errorCount = 0;
      let fetchErrorCount = 0;

      const fetchWithRetry = async (invoiceId, maxRetries = 2) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await accurateService.fetchDetail('purchase-invoice', invoiceId, branch.dbId, branchId);
            
            if (!response || !response.d) {
              return { error: true, id: invoiceId, message: 'Invalid response structure' };
            }
            
            return response;
          } catch (err) {
            const is502 = err.message?.includes('502 Bad Gateway');
            const isTimeout = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
            
            if ((is502 || isTimeout) && attempt < maxRetries) {
              console.log(`   ├─ 🔄 Retry ${attempt}/${maxRetries} for ID ${invoiceId} (${is502 ? '502' : 'timeout'})`);
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              continue;
            }
            
            return { error: true, id: invoiceId, message: err.message };
          }
        }
        
        return { error: true, id: invoiceId, message: 'Max retries exceeded' };
      };

      for (let i = 0; i < invoiceIdsToSync.length; i += batchSize) {
        const batch = invoiceIdsToSync.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        
        console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} items)`);
        console.log(`   ├─ Fetching details with retry...`);
        
        const batchPromises = batch.map(id => fetchWithRetry(id, 2));
        const batchDetails = await Promise.all(batchPromises);
        
        const successDetails = batchDetails.filter(d => !d.error);
        const failedDetails = batchDetails.filter(d => d.error);
        
        fetchErrorCount += failedDetails.length;
        
        console.log(`   ├─ Fetched: ${successDetails.length}/${batch.length} (${failedDetails.length} fetch errors)`);
        
        if (failedDetails.length > 0) {
          failedDetails.forEach(f => {
            console.log(`   │  ❌ ID ${f.id}: ${f.message}`);
          });
        }
        
        if (successDetails.length > 0) {
          console.log(`   └─ Saving ${successDetails.length} invoices to database...`);
          
          const saveResult = await purchaseInvoiceController._saveBatch(successDetails, branchId, branch.name);
          savedCount += saveResult.savedCount;
          errorCount += saveResult.errorCount;
          
          console.log(`   ✅ Batch ${batchNum} done: ${saveResult.savedCount} saved, ${saveResult.errorCount} save errors\n`);
        } else {
          console.log(`   ⚠️  Batch ${batchNum} skipped: No valid data to save\n`);
        }
        
        if (i + batchSize < invoiceIdsToSync.length) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const totalErrors = fetchErrorCount + errorCount;
      
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ SMART SYNC COMPLETED: ${branch.name} (Purchase Invoice)`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`📊 Saved: ${savedCount}, Errors: ${totalErrors}`);
      console.log(`${'='.repeat(60)}\n`);

      return reply.send({
        success: true,
        message: `Synced ${savedCount} invoices from ${branch.name}`,
        summary: {
          branch: branch.name,
          dateRange: { from: dateFrom || today, to: dateTo || today },
          totalChecked: allApiItems.length,
          totalToSync: invoiceIdsToSync.length,
          saved: savedCount,
          errors: totalErrors,
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

  // Sync all invoices from Accurate API (full sync)
  async syncFromAccurate(request, reply) {
    const startTime = Date.now();
    
    try {
        let {
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'transDate',
        batchSize = 50,
        batchDelay = 300
      } = request.query;

      // Ensure numeric values (query params are strings)
      batchSize = parseInt(batchSize, 10) || 20;
      batchDelay = parseInt(batchDelay, 10) || 500;

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
      console.log(`🚀 FULL SYNC STARTED: ${branch.name} (Purchase Invoice)`);
      console.log(`📅 Date Range: ${dateFrom || today} to ${dateTo || today}`);
      console.log(`${'='.repeat(60)}\n`);

      // 1. Get list of all invoices in date range
      const formatDateForAccurate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };
      
      const fromDate = formatDateForAccurate(dateFrom || today);
      const toDate = formatDateForAccurate(dateTo || today);
      
      const filters = createDateFilter(dateFilterType, fromDate, toDate);

      console.log(`📋 Fetching all invoices from ${fromDate} to ${toDate}...`);
      const apiResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, filters, branchId);
      let allApiItems = [...apiResult.items];
      
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      if (totalPages > 1) {
        console.log(`📄 Fetching ${totalPages - 1} more pages...`);
        for (let page = 2; page <= totalPages; page++) {
          const pageFilters = { ...filters, 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('purchase-invoice', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`📊 Total invoices to sync: ${allApiItems.length}\n`);

      if (allApiItems.length === 0) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ No invoices to sync.\n`);
        
        return reply.send({
          success: true,
          message: 'No invoices to sync',
          summary: {
            branch: branch.name,
            dateRange: { from: dateFrom || today, to: dateTo || today },
            totalFetched: 0,
            saved: 0,
            errors: 0,
            duration: `${duration}s`
          }
        });
      }

      // 2. Fetch details and save (in batches)
      let savedCount = 0;
      let errorCount = 0;
      let fetchErrorCount = 0;

      for (let i = 0; i < allApiItems.length; i += batchSize) {
        const batchNum = Math.floor(i / batchSize) + 1;
        const batchItems = allApiItems.slice(i, i + batchSize);
        
        console.log(`\n📦 Batch ${batchNum} (${batchItems.length} items):`);
        console.log(`   ├─ Fetching details...`);
        
        const detailsPromises = batchItems.map(item =>
          accurateService.fetchWithRetry('purchase-invoice', branch.dbId, item.id, branchId)
            .catch(err => ({ error: true, id: item.id, message: err.message }))
        );
        
        const detailsResults = await Promise.all(detailsPromises);
        
        const successDetails = detailsResults.filter(d => !d.error).map(d => d.d || d);
        const failedDetails = detailsResults.filter(d => d.error);
        
        if (failedDetails.length > 0) {
          console.log(`   │  ⚠️  ${failedDetails.length} fetch errors`);
          fetchErrorCount += failedDetails.length;
          failedDetails.forEach(f => {
            console.log(`   │  ❌ ID ${f.id}: ${f.message}`);
          });
        }
        
        if (successDetails.length > 0) {
          console.log(`   └─ Saving ${successDetails.length} invoices to database...`);
          
          const saveResult = await purchaseInvoiceController._saveBatch(successDetails, branchId, branch.name);
          savedCount += saveResult.savedCount;
          errorCount += saveResult.errorCount;
          
          console.log(`   ✅ Batch ${batchNum} done: ${saveResult.savedCount} saved, ${saveResult.errorCount} save errors\n`);
        } else {
          console.log(`   ⚠️  Batch ${batchNum} skipped: No valid data to save\n`);
        }
        
        if (i + batchSize < allApiItems.length) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const totalErrors = fetchErrorCount + errorCount;
      
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ FULL SYNC COMPLETED: ${branch.name} (Purchase Invoice)`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`📊 Saved: ${savedCount}, Errors: ${totalErrors}`);
      console.log(`${'='.repeat(60)}\n`);

      return reply.send({
        success: true,
        message: `Synced ${savedCount} invoices from ${branch.name}`,
        summary: {
          branch: branch.name,
          dateRange: { from: dateFrom || today, to: dateTo || today },
          totalFetched: allApiItems.length,
          saved: savedCount,
          errors: totalErrors,
          duration: `${duration}s`
        }
      });
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`\n❌ FULL SYNC FAILED after ${duration}s:`, error.message);
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
          const errorMsg = `Skipping item with no ID`;
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
          
          return null;
        };
        
        const headerData = {
          invoice_id: invoiceData.id,
          invoice_number: invoiceData.number,
          branch_id: branchId,
          branch_name: branchName,
          trans_date: convertDate(invoiceData.transDate),
          invoice_date: convertDate(invoiceData.transDate),
          due_date: convertDate(invoiceData.dueDate),
          vendor_id: invoiceData.vendor?.id || null,
          vendor_name: invoiceData.vendor?.name || null,
          bill_number: invoiceData.billNumber || null,
          subtotal: invoiceData.subTotal || 0,
          tax_amount: invoiceData.tax1Amount || 0,
          total_amount: invoiceData.totalAmount || 0,
          prime_owing: invoiceData.primeOwing || 0,
          status_name: invoiceData.statusName || null,
          ap_account_id: invoiceData.apAccount?.id || null,
          ap_account_no: invoiceData.apAccount?.no || null,
          created_by: invoiceData.createdBy || null,
          opt_lock: parseInt(invoiceData.optLock || 0),
          raw_data: invoiceData
        };

        const items = (invoiceData.detailItem || []).map(detail => ({
          detail_id: detail.id || null,
          item_id: detail.itemId || null,
          item_no: detail.item?.no || 'N/A',
          item_name: detail.detailName || detail.item?.name || '',
          quantity: detail.quantity || 0,
          unit_name: detail.itemUnit?.name || '',
          unit_price: detail.unitPrice || 0,
          discount: detail.itemCashDiscount || 0,
          amount: detail.purchaseAmountBase || detail.totalPrice || 0,
          warehouse_id: detail.warehouse?.id || null,
          warehouse_name: detail.warehouse?.name || null,
          gl_inventory_id: detail.item?.inventoryGlAccountId || null,
          gl_cogs_id: detail.item?.cogsGlAccountId || null,
          item_category: detail.item?.itemCategoryId || null
        }));

        await purchaseInvoiceModel.create(headerData, items);
        savedCount++;
        
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

    if (errors.length > 0 && errors.length <= 5) {
      console.log(`\n⚠️  Error Details:`);
      errors.forEach(e => console.log(`   - ${e.invoice}: ${e.error}`));
    } else if (errors.length > 5) {
      console.log(`\n⚠️  ${errors.length} errors occurred. First 5:`);
      errors.slice(0, 5).forEach(e => console.log(`   - ${e.invoice}: ${e.error}`));
    }

    return { savedCount, errorCount };
  },

  // Get invoices from database
  async getInvoices(request, reply) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        vendorId,
        statusName,
        limit = 100,
        offset = 0
      } = request.query;

      const filters = {
        branch_id: branchId,
        date_from: dateFrom,
        date_to: dateTo,
        vendor_id: vendorId,
        status_name: statusName,
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
