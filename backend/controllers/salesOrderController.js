const accurateService = require('../services/accurateService');
const salesOrderModel = require('../models/salesOrderModel');

// Helper: Create date filter for Accurate API
const createDateFilter = (dateFilterType, fromDate, toDate) => {
  const filterKey = `filter.${dateFilterType}`;
  const filters = {
    [`${filterKey}.op`]: 'BETWEEN',
    [`${filterKey}.val`]: [fromDate, toDate]
  };
  
  return filters;
};

const salesOrderController = {
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

      console.log(`🔍 Checking sync status for ${branch.name} (Sales Order)...`);
      console.log(`📅 Date Filter:`, {
        filterType: dateFilterType,
        from: fromDate,
        to: toDate
      });

      // 1. Fetch list from Accurate API
      const apiResult = await accurateService.fetchListOnly('sales-order', branch.dbId, filters, branchId);
      
      let allApiItems = [...apiResult.items];
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      
      console.log(`📄 Calculated: ${totalPages} total pages (${apiResult.pagination.rowCount} rows)`);
      
      if (totalPages > 1) {
        console.log(`📄 Fetching ${totalPages - 1} more pages...`);
        for (let page = 2; page <= totalPages; page++) {
          const pageFilters = { ...filters, 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('sales-order', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📊 API: ${allApiItems.length} orders`);
      if (allApiItems.length > 0) {
        console.log(`📊 Sample API order IDs:`, allApiItems.slice(0, 5).map(o => o.id));
      }

      // 2. Get existing from database
      const dbOrders = await salesOrderModel.getExistingForSync(
        branchId,
        dateFrom || today,
        dateTo || today
      );

      console.log(`💾 DB: ${dbOrders.length} orders`);
      if (dbOrders.length > 0) {
        console.log(`💾 Sample DB order IDs:`, dbOrders.slice(0, 5).map(o => o.order_id));
      }

      // 3. Create lookup map (convert order_id to number for comparison)
      const dbMap = new Map(dbOrders.map(ord => [parseInt(ord.order_id), ord]));

      // 4. Categorize
      const newOrders = [];
      const updatedOrders = [];
      const unchangedOrders = [];

      for (const apiOrd of allApiItems) {
        const dbOrd = dbMap.get(apiOrd.id);

        if (!dbOrd) {
          newOrders.push({
            id: apiOrd.id,
            number: apiOrd.number,
            optLock: apiOrd.optLock
          });
        } else {
          const apiOptLock = parseInt(apiOrd.optLock || 0);
          const dbOptLock = parseInt(dbOrd.opt_lock || 0);

          if (apiOptLock > dbOptLock) {
            updatedOrders.push({
              id: apiOrd.id,
              number: apiOrd.number,
              optLock: apiOrd.optLock,
              dbOptLock: dbOrd.opt_lock
            });
          } else {
            unchangedOrders.push({
              id: apiOrd.id,
              number: apiOrd.number
            });
          }
        }
      }

      const needSync = newOrders.length + updatedOrders.length;

      console.log(`✅ Check complete: ${newOrders.length} new, ${updatedOrders.length} updated, ${unchangedOrders.length} unchanged`);

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
          new: newOrders.length,
          updated: updatedOrders.length,
          unchanged: unchangedOrders.length,
          needSync: needSync,
          inDatabase: dbOrders.length
        },
        orders: {
          new: newOrders.slice(0, 20),
          updated: updatedOrders.slice(0, 20),
          hasMore: {
            new: newOrders.length > 20,
            updated: updatedOrders.length > 20
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

  // Helper: Save batch of orders to database
  async _saveBatch(items, branchId, branchName) {
    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const item of items) {
      try {
        const orderData = item.d || item;
        
        if (!orderData || !orderData.id) {
          const errorMsg = `Skipping item with no ID`;
          console.warn(`⚠️  ${errorMsg}`);
          errors.push({ order: 'unknown', error: errorMsg });
          errorCount++;
          continue;
        }
        
        const convertDate = (dateStr) => {
          if (!dateStr) return null;
          const [day, month, year] = dateStr.split('/');
          return `${year}-${month}-${day}`;
        };
        
        const headerData = {
          order_id: orderData.id,
          order_number: orderData.number,
          branch_id: branchId,
          branch_name: branchName,
          trans_date: convertDate(orderData.transDate),
          delivery_date: convertDate(orderData.shipDate),
          po_number: orderData.poNumber || null,
          customer_id: orderData.customer?.customerNo || null,
          customer_name: orderData.customer?.name || null,
          customer_address: orderData.customer?.shipAddress?.concatFullAddress || orderData.customer?.shipAddress?.address || null,
          salesman_id: orderData.masterSalesmanId || null,
          salesman_name: orderData.masterSalesmanName || null,
          warehouse_id: null,
          warehouse_name: null,
          subtotal: orderData.subTotal || 0,
          discount: orderData.cashDiscount || 0,
          tax: orderData.tax1Amount || 0,
          total: orderData.totalAmount || 0,
          order_status: orderData.status || null,
          opt_lock: orderData.optLock || 0,
          raw_data: orderData
        };

        const items = (orderData.detailItem || []).map(detail => ({
          item_no: detail.item?.no || 'N/A',
          item_name: detail.item?.name || '',
          quantity: detail.quantity || 0,
          unit_name: detail.itemUnit?.name || '',
          unit_price: detail.unitPrice || 0,
          discount: detail.itemCashDiscount || 0,
          amount: detail.salesAmount || detail.totalPrice || 0,
          warehouse_name: detail.warehouse?.name || detail.defaultWarehouseDeliveryOrder?.name || null,
          warehouse_address: detail.warehouse?.address || null,
          salesman_name: detail.salesmanName || detail.salesmanList?.[0]?.name || null,
          item_category: detail.item?.itemCategoryId || null,
          item_notes: detail.detailNotes || null
        }));

        await salesOrderModel.create(headerData, items);
        savedCount++;
        
        if (savedCount % 10 === 0) {
          process.stdout.write(`💾 Saved: ${savedCount}\r`);
        }
      } catch (err) {
        const orderNum = item.d?.number || item.number || 'unknown';
        console.error(`❌ Error saving order ${orderNum}:`, err.message);
        errors.push({ order: orderNum, error: err.message });
        errorCount++;
      }
    }

    if (errors.length > 0 && errors.length <= 5) {
      console.log(`\n⚠️  Error Details:`);
      errors.forEach(e => console.log(`   - ${e.order}: ${e.error}`));
    } else if (errors.length > 5) {
      console.log(`\n⚠️  ${errors.length} errors occurred. First 5:`);
      errors.slice(0, 5).forEach(e => console.log(`   - ${e.order}: ${e.error}`));
    }

    return { savedCount, errorCount, errors };
  },

  // Smart sync: Only sync new + updated orders
  async syncSmart(request, reply) {
    const startTime = Date.now();
    
    try {
      let {
        branchId, 
        dateFrom, 
        dateTo, 
        dateFilterType = 'transDate',
        batchSize = 20,
        batchDelay = 500,
        mode = 'missing'
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
      console.log(`🚀 SMART SYNC STARTED: ${branch.name} (Sales Order)`);
      console.log(`📅 Date Range: ${dateFrom || today} to ${dateTo || today}`);
      console.log(`⚙️  Mode: ${mode === 'missing' ? 'Missing Only' : 'All'}`);
      console.log(`${'='.repeat(60)}\n`);

      // 1. Check sync status first
      const checkRequest = { query: { branchId, dateFrom, dateTo, dateFilterType } };
      const checkReply = { send: (data) => data, code: () => checkReply };
      const checkResult = await salesOrderController.checkSyncStatus(checkRequest, checkReply);

      if (!checkResult.success) {
        return reply.code(500).send({ error: 'Failed to check sync status' });
      }

      console.log(`📊 Sync Status:`);
      console.log(`   - Total in API: ${checkResult.summary.total}`);
      console.log(`   - New: ${checkResult.summary.new}`);
      console.log(`   - Updated: ${checkResult.summary.updated}`);
      console.log(`   - Unchanged: ${checkResult.summary.unchanged}`);
      console.log(`   - Need Sync: ${checkResult.summary.needSync}\n`);

      // 2. Determine which orders to sync
      let orderIdsToSync = [];
      
      const formatDateForAccurate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };
      
      const fromDate = formatDateForAccurate(dateFrom || today);
      const toDate = formatDateForAccurate(dateTo || today);
      const filters = createDateFilter(dateFilterType, fromDate, toDate);
      
      console.log(`📋 Fetching full list to get all IDs...`);
      const apiResult = await accurateService.fetchListOnly('sales-order', branch.dbId, filters, branchId);
      let allApiItems = [...apiResult.items];
      
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page++) {
          const pageFilters = { ...filters, 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('sales-order', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (mode === 'missing') {
        const dbOrders = await salesOrderModel.getExistingForSync(branchId, dateFrom || today, dateTo || today);
        const dbMap = new Map(dbOrders.map(ord => [ord.order_id, ord]));
        
        for (const apiOrd of allApiItems) {
          const dbOrd = dbMap.get(apiOrd.id);
          
          if (!dbOrd) {
            orderIdsToSync.push(apiOrd.id);
          } else {
            const apiOptLock = parseInt(apiOrd.optLock || 0);
            const dbOptLock = parseInt(dbOrd.opt_lock || 0);
            
            if (apiOptLock > dbOptLock) {
              orderIdsToSync.push(apiOrd.id);
            }
          }
        }
        
        console.log(`⚡ Syncing missing only: ${orderIdsToSync.length} orders\n`);
      } else {
        orderIdsToSync = allApiItems.map(ord => ord.id);
        console.log(`🔄 Re-syncing all: ${orderIdsToSync.length} orders\n`);
      }

      if (orderIdsToSync.length === 0) {
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

      // 3. Fetch details and save (in batches with retry)
      const totalBatches = Math.ceil(orderIdsToSync.length / batchSize);
      let savedCount = 0;
      let errorCount = 0;
      let fetchErrorCount = 0;
      const errorDetails = [];
      
      // Helper: Fetch with retry
      const fetchWithRetry = async (id, maxRetries = 2) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await accurateService.fetchDetail('sales-order', id, branch.dbId, branchId);

            if (!response) {
              return { error: true, id: id, message: 'No response from Accurate API' };
            }

            // Accurate API may return a valid HTTP response but with s:false (rate limit, etc.)
            if (response.s === false) {
              const isJdbc = response.d && Array.isArray(response.d) && response.d[0]?.includes('Unable to acquire JDBC Connection');

              if (isJdbc && attempt < maxRetries) {
                console.log(`   ├─ 🔄 Retry ${attempt}/${maxRetries} for ID ${id} (JDBC error)`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
              }

              const message = Array.isArray(response.d)
                ? response.d.join(' | ')
                : (typeof response.d === 'string' ? response.d : JSON.stringify(response.d || response));

              return { error: true, id: id, message };
            }

            if (!response.d || !response.d.id) {
              return { error: true, id: id, message: 'Invalid response structure' };
            }

            return response;
          } catch (err) {
            const is502 = err.message?.includes('502 Bad Gateway');
            const isTimeout = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
            
            if ((is502 || isTimeout) && attempt < maxRetries) {
              console.log(`   ├─ 🔄 Retry ${attempt}/${maxRetries} for ID ${id} (${is502 ? '502' : 'timeout'})`);
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              continue;
            }
            
            return { error: true, id: id, message: err.message };
          }
        }
        
        return { error: true, id: id, message: 'Max retries exceeded' };
      };

      for (let i = 0; i < orderIdsToSync.length; i += batchSize) {
        const batch = orderIdsToSync.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        
        console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} items)`);
        console.log(`   ├─ Fetching details with retry...`);
        
        const batchPromises = batch.map(id => fetchWithRetry(id, 2));
        const batchDetails = await Promise.all(batchPromises);
        
        const successDetails = batchDetails.filter(d => !d.error);
        const failedDetails = batchDetails.filter(d => d.error);
        
        // Collect fetch errors for response
        failedDetails.forEach(fd => errorDetails.push({ id: fd.id, stage: 'fetch', message: fd.message }));
        
        fetchErrorCount += failedDetails.length;
        
        console.log(`   ├─ Fetched: ${successDetails.length}/${batch.length} (${failedDetails.length} fetch errors)`);
        
        if (successDetails.length > 0) {
          console.log(`   └─ Saving ${successDetails.length} orders to database...`);
          
          const saveResult = await salesOrderController._saveBatch(successDetails, branchId, branch.name);
          savedCount += saveResult.savedCount;
          errorCount += saveResult.errorCount;
          // Append save errors
          if (saveResult.errors && Array.isArray(saveResult.errors)) {
            saveResult.errors.forEach(errObj => errorDetails.push({ id: errObj.order, stage: 'save', message: errObj.error }));
          }
          
          console.log(`   ✅ Batch ${batchNum} done: ${saveResult.savedCount} saved, ${saveResult.errorCount} save errors\n`);
        } else {
          console.log(`   ⚠️  Batch ${batchNum} skipped: No valid data to save\n`);
        }
        
        if (i + batchSize < orderIdsToSync.length) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const totalErrors = fetchErrorCount + errorCount;
      
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ SMART SYNC COMPLETED: ${branch.name} (Sales Order)`);
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
        errors: errorDetails,
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

  // Get orders from database
  async getOrders(request, reply) {
    try {
      const { 
        branchId, 
        dateFrom, 
        dateTo, 
        customerId,
        orderStatus,
        limit = 100,
        offset = 0
      } = request.query;

      const filters = {
        branch_id: branchId,
        date_from: dateFrom,
        date_to: dateTo,
        customer_id: customerId,
        order_status: orderStatus,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const orders = await salesOrderModel.list(filters);

      return reply.send({
        success: true,
        count: orders.length,
        data: orders
      });
    } catch (error) {
      console.error('Error in getOrders:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Get order detail by ID
  async getOrderById(request, reply) {
    try {
      const { id } = request.params;

      const order = await salesOrderModel.getById(id);

      if (!order) {
        return reply.code(404).send({ error: 'Order not found' });
      }

      return reply.send({
        success: true,
        data: order
      });
    } catch (error) {
      console.error('Error in getOrderById:', error);
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

      const summary = await salesOrderModel.getSummary(filters);

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

module.exports = salesOrderController;
