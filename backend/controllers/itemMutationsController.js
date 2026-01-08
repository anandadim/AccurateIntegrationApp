const db = require('../config/database');
const accurateService = require('../services/accurateService');
const itemMutationsModel = require('../models/itemMutationsModel');

// Helper: Create date filter for Accurate API
// If both from & to provided ➜ BETWEEN using array values
// If only from provided ➜ GREATER_THAN using single value (fetch up to latest data)
const createDateFilter = (dateFilterType, fromDate, toDate = null) => {
  const filterKey = `filter.${dateFilterType}`;

  if (toDate) {
    return {
      [`${filterKey}.op`]: 'BETWEEN',
      [`${filterKey}.val`]: [fromDate, toDate]
    };
  }

  return {
    [`${filterKey}.op`]: 'GREATER_THAN',
    [`${filterKey}.val`]: fromDate
  };
};

const itemMutationsController = {
  // Check sync status (compare API vs Database)
  async checkSyncStatus(request, reply) {
    const startTime = Date.now();

    try {
      const { 
        branchId, 
        warehouseId,
        dateFrom, 
        dateTo
      } = request.query;

      const dateFilterField = 'createDate';

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
      const toDate = dateTo ? formatDateForAccurate(dateTo) : null;
      
      // Create date filter
      const filters = createDateFilter(dateFilterField, fromDate, toDate);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 CHECKING SYNC STATUS: ${branch.name}`);
      if (warehouseId) {
        console.log(`🏭 Filtering by warehouse ID: ${warehouseId}`);
      }
      console.log(`📅 Date Filter:`, {
        filterType: dateFilterField,
        from: fromDate,
        to: toDate || 'LATEST'
      });
      console.log(`🔧 API Filters:`, filters);
      console.log(`${'='.repeat(60)}\n`);

      // Add warehouse filter if specified
      if (warehouseId) {
        filters.warehouseId = warehouseId;
      }

      // 1. Fetch from API (all pages)
      const apiResult = await accurateService.fetchListOnly('item/stock-mutation-history', branch.dbId, filters, branchId);
      
      console.log('📦 API Response structure:', JSON.stringify(apiResult, null, 2).substring(0, 500));
      
      if (!apiResult || !apiResult.items || !Array.isArray(apiResult.items)) {
        console.error('❌ Invalid response from Accurate API:', apiResult);
        return reply.code(500).send({
          error: 'Invalid response from Accurate API',
          message: 'API response does not contain items array',
          response: apiResult
        });
      }
      
      let allApiItems = [...apiResult.items];

      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      const MAX_PAGES = 1000; // Safety limit
      let pagesToFetch = totalPages;

      if (totalPages > MAX_PAGES) {
        console.warn(`⚠️  Too many pages (${totalPages})! Limiting to ${MAX_PAGES} pages.`);
        pagesToFetch = MAX_PAGES;
      }

      if (pagesToFetch > 1) {
        console.log(`📄 Fetching ${pagesToFetch - 1} more pages...`);
        for (let page = 2; page <= pagesToFetch; page++) {
          const pageFilters = { ...filters, 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('item/stock-mutation-history', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📊 API: ${allApiItems.length} mutations`);

      // 2. Get existing from database
      const dbMutations = await itemMutationsModel.getExistingForSync(
        branchId,
        dateFrom || today,
        dateTo || null
      );

      console.log(`💾 DB: ${dbMutations.length} mutations`);

      // 3. Create lookup map
      const dbMap = new Map(dbMutations.map(m => [String(m.mutation_id), m]));

      // 4. Categorize
      const newMutations = [];
      const updatedMutations = [];
      const unchangedMutations = [];

      for (const apiMut of allApiItems) {
        const dbMut = dbMap.get(String(apiMut.id));

        if (!dbMut) {
          newMutations.push({
            id: apiMut.id,
            number: apiMut.number,
            optLock: apiMut.optLock
          });
        } else {
          const apiOptLock = parseInt(apiMut.optLock || 0);
          const dbOptLock = parseInt(dbMut.opt_lock || 0);

          if (apiOptLock > dbOptLock) {
            updatedMutations.push({
              id: apiMut.id,
              number: apiMut.number,
              optLock: apiMut.optLock,
              dbOptLock: dbMut.opt_lock
            });
          } else {
            unchangedMutations.push({
              id: apiMut.id,
              number: apiMut.number
            });
          }
        }
      }

      const needSync = newMutations.length + updatedMutations.length;

      console.log(`✅ Check complete: ${newMutations.length} new, ${updatedMutations.length} updated, ${unchangedMutations.length} unchanged`);

      return reply.send({
        success: true,
        branch: {
          id: branch.id,
          name: branch.name,
          dbId: branch.dbId
        },
        dateRange: {
          from: dateFrom || today,
          to: dateTo || null,
          filterType: dateFilterField
        },
        summary: {
          total: allApiItems.length,
          new: newMutations.length,
          updated: updatedMutations.length,
          unchanged: unchangedMutations.length,
          needSync: needSync,
          inDatabase: dbMutations.length
        },
        mutations: {
          new: newMutations.slice(0, 20),
          updated: updatedMutations.slice(0, 20),
          hasMore: {
            new: newMutations.length > 20,
            updated: updatedMutations.length > 20
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

  // Count item mutations without fetching details (dry-run)
  async countMutations(request, reply) {
    try {
      const { branchId } = request.query;

      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }

      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);

      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      console.log(`Counting ALL mutations for ${branch.name}...`);

      const response = await accurateService.fetchListOnly('item/stock-mutation-history', branch.dbId, {}, branchId);

      if (!response.pagination) {
        return reply.code(500).send({ error: 'Invalid response from Accurate API' });
      }

      const totalRows = response.pagination.rowCount;
      const pageSize = response.pagination.pageSize || 1000;
      const totalPages = Math.ceil(totalRows / pageSize);

      return reply.send({
        success: true,
        branch: {
          id: branch.id,
          name: branch.name,
          dbId: branch.dbId
        },
        count: {
          totalMutations: totalRows,
          pageSize: pageSize,
          totalPages: totalPages,
          estimatedApiCalls: totalRows,
          estimatedTime: `~${Math.ceil(totalRows / 50 * 0.3)} seconds`
        }
      });
    } catch (error) {
      console.error('Error in countMutations:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message
      });
    }
  },

  // Sync item mutations from Accurate API
  async syncFromAccurate(request, reply) {
    const startTime = Date.now();

    try {
      const {
        branchId,
        maxItems,
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

      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 SYNC STARTED: ${branch.name}`);
      console.log(`📅 Fetching ALL mutations (no date filter)`);
      console.log(`⚙️  Batch Size: ${batchSize}, Delay: ${batchDelay}ms`);
      console.log(`${'='.repeat(60)}\n`);

      if (streamInsert === 'true') {
        const result = await accurateService.fetchAndStreamInsert(
          'item/stock-mutation-history',
          branch.dbId,
          {
            maxItems,
            batchSize: parseInt(batchSize),
            batchDelay: parseInt(batchDelay)
          },
          branchId,
          branch.name,
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
          message: `Synced ${result.savedCount} mutations from ${branch.name}`,
          summary: {
            branch: branch.name,
            totalFetched: result.totalFetched,
            saved: result.savedCount,
            errors: result.errorCount,
            duration: `${duration}s`
          }
        });
      }

      const result = await accurateService.fetchListWithDetails(
        'item/stock-mutation-history',
        branch.dbId,
        {
          maxItems,
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
        message: `Synced ${saveResult.savedCount} mutations from ${branch.name}`,
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

  // Helper: Save batch of mutations to database
  async _saveBatch(items, branchId, branchName) {
    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const item of items) {
      try {
        const mutationData = item.d || item;

        if (!mutationData || !mutationData.id) {
          const errorMsg = `Skipping item with no ID. Item structure: ${JSON.stringify(item).substring(0, 200)}`;
          console.warn(`⚠️  ${errorMsg}`);
          errors.push({ mutation: 'unknown', error: errorMsg });
          errorCount++;
          continue;
        }

        const convertDate = (dateStr) => {
          if (!dateStr) return null;
          const [datePart] = dateStr.split(' '); // handle "dd/mm/yyyy" or "dd/mm/yyyy HH:MM:SS"
          const [day, month, year] = datePart.split('/');
          if (!day || !month || !year) {
            return null;
          }
          return `${year}-${month}-${day}`;
        };

        const headerData = {
          mutation_id: mutationData.id,
          mutation_number: mutationData.number || mutationData.mutationNumber || mutationData.transactionNumber || `MUT-${mutationData.id}`,
          branch_id: branchId,
          branch_name: branchName,
          trans_date: convertDate(mutationData.transDate || mutationData.transactionDate),
          mutation_type: mutationData.mutationType || mutationData.transactionType || null,
          warehouse_id: mutationData.warehouse?.id || mutationData.warehouseId || null,
          warehouse_name: mutationData.warehouse?.name || mutationData.warehouseName || null,
          total_quantity: mutationData.totalQuantity ?? mutationData.mutation ?? 0,
          total_value: mutationData.totalValue ?? mutationData.itemCost ?? 0,
          raw_data: mutationData
        };

        await itemMutationsModel.create(headerData);
        savedCount++;

        if (savedCount % 10 === 0) {
          process.stdout.write(`💾 Saved: ${savedCount}\r`);
        }
      } catch (err) {
        const mutationNum = item.d?.number || item.number || 'unknown';
        const mutationId = item.d?.id || item.id || 'unknown';
        console.error(`❌ Error saving mutation ${mutationNum}: ${mutationId}`, err.message);
        errors.push({ mutation: mutationNum, error: err.message });
        errorCount++;
      }
    }

    if (errors.length > 0 && errors.length <= 5) {
      console.log(`\n⚠️  Error Details:`);
      errors.forEach(e => console.log(`   - ${e.mutation}: ${e.error}`));
    } else if (errors.length > 5) {
      console.log(`\n⚠️  ${errors.length} errors occurred. First 5:`);
      errors.slice(0, 5).forEach(e => console.log(`   - ${e.mutation}: ${e.error}`));
    }

    return { savedCount, errorCount, errors };
  },

  // Smart sync: Only sync new + updated mutations
  async syncSmart(request, reply) {
    const startTime = Date.now();

    try {
      const { 
        branchId, 
        warehouseId,
        dateFrom, 
        dateTo,
        batchSize = 50,
        batchDelay = 300,
        mode = 'missing' // 'missing' or 'all'
      } = request.query;

      const dateFilterField = 'createDate';

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
      if (warehouseId) {
        console.log(`🏭 Filtering by warehouse ID: ${warehouseId}`);
      }
      console.log(`📅 Date Range: ${dateFrom || today} to ${dateTo || today}`);
      console.log(`⚙️  Mode: ${mode === 'missing' ? 'Missing Only' : 'All'}`);
      console.log(`${'='.repeat(60)}\n`);

      // 1. Check sync status first
      const checkRequest = { query: { branchId, warehouseId, dateFrom, dateTo } };
      const checkReply = { send: (data) => data, code: () => checkReply };
      const checkResult = await itemMutationsController.checkSyncStatus(checkRequest, checkReply);

      if (!checkResult.success) {
        return reply.code(500).send({ error: 'Failed to check sync status' });
      }

      console.log(`📊 Sync Status:`);
      console.log(`   - Total in API: ${checkResult.summary.total}`);
      console.log(`   - New: ${checkResult.summary.new}`);
      console.log(`   - Updated: ${checkResult.summary.updated}`);
      console.log(`   - Unchanged: ${checkResult.summary.unchanged}`);
      console.log(`   - Need Sync: ${checkResult.summary.needSync}\n`);

      // 2. Determine which mutations to sync
      let mutationIdsToSync = [];
      let allApiItems = [];

      const formatDateForAccurate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      };

      const fromDate = formatDateForAccurate(dateFrom || today);
      const toDate = dateTo ? formatDateForAccurate(dateTo) : null;

      let filters = createDateFilter(dateFilterField, fromDate, toDate);

      // Add warehouse filter if specified
      if (warehouseId) {
        filters.warehouseId = warehouseId;
      }

      if (mode === 'missing') {
        // Sync only new + updated
        console.log(`📋 Fetching full list to get all IDs...`);
        const apiResult = await accurateService.fetchListOnly('item/stock-mutation-history', branch.dbId, filters, branchId);
        allApiItems = [...apiResult.items];

        const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
        if (totalPages > 1) {
          for (let page = 2; page <= totalPages; page++) {
            const pageFilters = { ...filters, 'sp.page': page };
            const pageResult = await accurateService.fetchListOnly('item/stock-mutation-history', branch.dbId, pageFilters, branchId);
            allApiItems = allApiItems.concat(pageResult.items);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Get existing from database
        const dbMutations = await itemMutationsModel.getExistingForSync(branchId, dateFrom || today, dateTo || null);
        const dbMap = new Map(dbMutations.map(m => [m.mutation_id, m]));

        // Filter only new + updated
        for (const apiMut of allApiItems) {
          const dbMut = dbMap.get(apiMut.id);

          if (!dbMut) {
            // New
            mutationIdsToSync.push(apiMut.id);
          } else {
            // Check if updated
            const apiOptLock = parseInt(apiMut.optLock || 0);
            const dbOptLock = parseInt(dbMut.opt_lock || 0);

            if (apiOptLock > dbOptLock) {
              // Updated
              mutationIdsToSync.push(apiMut.id);
            }
          }
        }

        console.log(`⚡ Syncing missing only: ${mutationIdsToSync.length} mutations (${checkResult.summary.new} new + ${checkResult.summary.updated} updated)\n`);
      } else {
        // Sync all (re-sync everything)
        console.log(`📋 Fetching full list for re-sync...`);
        const apiResult = await accurateService.fetchListOnly('item/stock-mutation-history', branch.dbId, filters, branchId);
        allApiItems = [...apiResult.items];

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
            const pageResult = await accurateService.fetchListOnly('item/stock-mutation-history', branch.dbId, pageFilters, branchId);
            allApiItems = allApiItems.concat(pageResult.items);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        mutationIdsToSync = allApiItems.map(m => m.id);
        console.log(`🔄 Re-syncing all: ${mutationIdsToSync.length} mutations\n`);
      }

      if (mutationIdsToSync.length === 0) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Nothing to sync! All data is up-to-date.\n`);

        return reply.send({
          success: true,
          message: 'All data is up-to-date',
          summary: {
            branch: branch.name,
            dateRange: { from: dateFrom || today, to: dateTo || null },
            totalChecked: checkResult.summary.total,
            synced: 0,
            skipped: checkResult.summary.unchanged,
            duration: `${duration}s`
          }
        });
      }

      // 3. Save mutations in batches (using list data directly, no detail fetch)
      let savedCount = 0;
      let errorCount = 0;
      const totalBatches = Math.ceil(mutationIdsToSync.length / parsedBatchSize);

      for (let i = 0; i < mutationIdsToSync.length; i += parsedBatchSize) {
        const batchIds = mutationIdsToSync.slice(i, i + parsedBatchSize);
        const batchNum = Math.floor(i / parsedBatchSize) + 1;

        console.log(`📦 Batch ${batchNum}/${totalBatches} (${batchIds.length} items)`);

        // Get mutation data from allApiItems
        const batchMutations = allApiItems.filter(m => batchIds.includes(m.id));

        if (batchMutations.length > 0) {
          console.log(`   └─ Saving ${batchMutations.length} mutations to database...`);

          // Save this batch
          const saveResult = await itemMutationsController._saveBatch(batchMutations, branchId, branch.name);
          savedCount += saveResult.savedCount;
          errorCount += saveResult.errorCount;

          console.log(`   ✅ Batch ${batchNum} done: ${saveResult.savedCount} saved, ${saveResult.errorCount} save errors\n`);
        } else {
          console.log(`   ⚠️  Batch ${batchNum} skipped: No data found\n`);
        }

        // Delay between batches
        if (i + parsedBatchSize < mutationIdsToSync.length) {
          await new Promise(resolve => setTimeout(resolve, parsedBatchDelay));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`${'='.repeat(60)}`);
      console.log(`✅ SMART SYNC COMPLETED: ${branch.name}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`📊 Results:`);
      console.log(`   - Synced: ${savedCount}`);
      console.log(`   - Save Errors: ${errorCount}`);
      console.log(`   - Skipped (unchanged): ${checkResult.summary.unchanged}`);
      console.log(`${'='.repeat(60)}\n`);

      return reply.send({
        success: true,
        message: `Smart sync completed for ${branch.name}`,
        summary: {
          branch: branch.name,
          dateRange: { from: dateFrom || today, to: dateTo || null, filterType: dateFilterField },
          mode: mode,
          checked: {
            total: checkResult.summary.total,
            new: checkResult.summary.new,
            updated: checkResult.summary.updated,
            unchanged: checkResult.summary.unchanged
          },
          synced: savedCount,
          saveErrors: errorCount,
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

  // Get mutations from database
  async getMutations(request, reply) {
    try {
      const {
        branchId,
        mutationType,
        warehouseId,
        limit = 100,
        offset = 0
      } = request.query;

      const filters = {
        branch_id: branchId,
        mutation_type: mutationType,
        warehouse_id: warehouseId,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const mutations = await itemMutationsModel.list(filters);

      return reply.send({
        success: true,
        count: mutations.length,
        data: mutations
      });
    } catch (error) {
      console.error('Error in getMutations:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message
      });
    }
  },

  // Get mutation detail by ID
  async getMutationById(request, reply) {
    try {
      const { id } = request.params;

      const mutation = await itemMutationsModel.getById(id);

      if (!mutation) {
        return reply.code(404).send({ error: 'Mutation not found' });
      }

      return reply.send({
        success: true,
        data: mutation
      });
    } catch (error) {
      console.error('Error in getMutationById:', error);
      return reply.code(500).send({
        error: 'Internal server error',
        message: error.message
      });
    }
  },

  // Get summary statistics
  async getSummary(request, reply) {
    try {
      const { branchId } = request.query;

      const filters = {
        branch_id: branchId
      };

      const summary = await itemMutationsModel.getSummary(filters);

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

module.exports = itemMutationsController;
