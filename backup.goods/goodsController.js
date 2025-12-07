const accurateService = require('../services/accurateService');
const goodsModel = require('../models/goodsModel');

const goodsController = {
  // Check sync status (compare API vs Database)
  async checkSyncStatus(request, reply) {
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

      console.log(`🔍 Checking goods sync status for ${branch.name}...`);

      // 1. Fetch list from Accurate API (all pages)
      const apiResult = await accurateService.fetchListOnly('item', branch.dbId, {}, branchId);
      
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
      const MAX_PAGES = 100; // Max 100 pages = 100,000 items
      let pagesToFetch = totalPages;
      
      if (totalPages > MAX_PAGES) {
        console.warn(`⚠️  Too many pages (${totalPages})! Limiting to ${MAX_PAGES} pages for safety.`);
        console.warn(`⚠️  This will fetch ${MAX_PAGES * apiResult.pagination.pageSize} out of ${apiResult.pagination.rowCount} items.`);
        console.warn(`⚠️  Consider contacting admin.`);
        pagesToFetch = MAX_PAGES;
      }
      
      if (pagesToFetch > 1) {
        console.log(`📄 Fetching ${pagesToFetch - 1} more pages...`);
        for (let page = 2; page <= pagesToFetch; page++) {
          const pageFilters = { 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('item', branch.dbId, pageFilters, branchId);
          allApiItems = allApiItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📊 API: ${allApiItems.length} items`);

      // 2. Get existing from database
      const dbGoods = await goodsModel.getExistingForSync();

      console.log(`💾 DB: ${dbGoods.length} items`);

      // 3. Create lookup map
      const dbMap = new Map(dbGoods.map(g => [g.goods_id, g]));

      // 4. Categorize
      const newGoods = [];
      const updatedGoods = [];
      const unchangedGoods = [];

      for (const apiItem of allApiItems) {
        const dbItem = dbMap.get(apiItem.id);

        if (!dbItem) {
          // Not in DB → New
          newGoods.push({
            id: apiItem.id,
            no: apiItem.no,
            name: apiItem.name,
            optLock: apiItem.optLock
          });
        } else {
          // In DB → Check optLock
          const apiOptLock = parseInt(apiItem.optLock || 0);
          const dbOptLock = parseInt(dbItem.opt_lock || 0);

          if (apiOptLock > dbOptLock) {
            // Modified in Accurate → Updated
            updatedGoods.push({
              id: apiItem.id,
              no: apiItem.no,
              name: apiItem.name,
              optLock: apiItem.optLock,
              dbOptLock: dbItem.opt_lock
            });
          } else {
            // Same → Unchanged
            unchangedGoods.push({
              id: apiItem.id,
              no: apiItem.no,
              name: apiItem.name
            });
          }
        }
      }

      const needSync = newGoods.length + updatedGoods.length;

      console.log(`✅ Check complete: ${newGoods.length} new, ${updatedGoods.length} updated, ${unchangedGoods.length} unchanged`);

      return reply.send({
        success: true,
        branch: {
          id: branch.id,
          name: branch.name,
          dbId: branch.dbId
        },
        summary: {
          total: allApiItems.length,
          new: newGoods.length,
          updated: updatedGoods.length,
          unchanged: unchangedGoods.length,
          needSync: needSync,
          inDatabase: dbGoods.length
        },
        goods: {
          new: newGoods.slice(0, 20),  // Limit to 20 for display
          updated: updatedGoods.slice(0, 20),
          hasMore: {
            new: newGoods.length > 20,
            updated: updatedGoods.length > 20
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

  // Count goods in database
  async count(request, reply) {
    try {
      const result = await goodsModel.list({ limit: 1 });
      const countResult = await accurateService.db.query('SELECT COUNT(*) FROM goods');
      
      return reply.send({
        success: true,
        count: parseInt(countResult.rows[0].count)
      });
    } catch (error) {
      console.error('Error in count:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Sync goods from Accurate
  async sync(request, reply) {
    try {
      const { 
        branchId,
        batchSize = 50,
        delayMs = 100,
        streamInsert = false
      } = request.body;

      if (!branchId) {
        return reply.code(400).send({ error: 'branchId is required' });
      }

      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        return reply.code(404).send({ error: 'Branch not found' });
      }

      console.log(`🚀 Starting goods sync for ${branch.name}...`);
      console.log(`⚙️  Config: batchSize=${batchSize}, delayMs=${delayMs}, streamInsert=${streamInsert}`);

      const startTime = Date.now();
      let saved = 0;
      let errors = 0;
      let processed = 0;

      // 1. Fetch list from Accurate API (all pages)
      const apiResult = await accurateService.fetchListOnly('item', branch.dbId, {}, branchId);
      
      // Debug: Log pagination info
      console.log(`📊 API Pagination:`, {
        rowCount: apiResult.pagination.rowCount,
        pageSize: apiResult.pagination.pageSize,
        currentPage: apiResult.pagination.page || 1
      });
      
      // Fetch all pages if needed
      let allItems = [...apiResult.items];
      const totalPages = Math.ceil(apiResult.pagination.rowCount / apiResult.pagination.pageSize);
      
      console.log(`📄 Calculated: ${totalPages} total pages (${apiResult.pagination.rowCount} rows ÷ ${apiResult.pagination.pageSize} per page)`);
      
      // Safety: Limit max pages to avoid excessive API calls
      const MAX_PAGES = 100; // Max 100 pages = 100,000 items
      let pagesToFetch = totalPages;
      
      if (totalPages > MAX_PAGES) {
        console.warn(`⚠️  Too many pages (${totalPages})! Limiting to ${MAX_PAGES} pages for safety.`);
        console.warn(`⚠️  This will fetch ${MAX_PAGES * apiResult.pagination.pageSize} out of ${apiResult.pagination.rowCount} items.`);
        console.warn(`⚠️  Consider contacting admin.`);
        pagesToFetch = MAX_PAGES;
      }
      
      if (pagesToFetch > 1) {
        console.log(`📄 Fetching ${pagesToFetch - 1} more pages...`);
        for (let page = 2; page <= pagesToFetch; page++) {
          const pageFilters = { 'sp.page': page };
          const pageResult = await accurateService.fetchListOnly('item', branch.dbId, pageFilters, branchId);
          allItems = allItems.concat(pageResult.items);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`📦 Total items to sync: ${allItems.length}`);
      
      // 2. Fetch details for all items in batches
      const detailedItems = [];
      const detailBatchSize = 10; // Smaller batch for detail fetching
      
      for (let i = 0; i < allItems.length; i += detailBatchSize) {
        const batch = allItems.slice(i, i + batchSize);
        console.log(`� Fetching details for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allItems.length/batchSize)} (${batch.length} items)...`);
        
        const batchPromises = batch.map(item => 
          accurateService.fetchDetail('item', item.id, branch.dbId, branchId)
            .catch(err => {
              console.error(`❌ Failed to fetch detail for item ${item.id}:`, err.message);
              return null;
            })
        );
        
        const batchResults = await Promise.all(batchPromises);
        const validResults = batchResults.filter(result => result !== null);
        detailedItems.push(...validResults);
        
        // Delay between batches
        if (i + batchSize < allItems.length) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      console.log(`✅ Fetched ${detailedItems.length} detailed items out of ${allItems.length} total items`);

      console.log(`📦 Total items to sync: ${allItems.length}`);

      // Process in batches
      for (let i = 0; i < allItems.length; i += batchSize) {
        const batch = allItems.slice(i, i + batchSize);
        
        for (const item of batch) {
          try {
            // Transform API data to database format
            const goodsData = {
              goods_id: item.id,
              goods_no: item.no || `ITEM-${item.id}`,
              goods_name: item.name || item.shortName || `Item ${item.id}`,
              short_name: item.shortName || null,
              category_id: item.itemCategory?.id || null,
              category_name: item.itemCategory?.name || null,
              unit1_id: item.unit1?.id || null,
              unit1_name: item.unit1?.name || null,
              unit1_price: item.unit1Price || 0,
              cost: item.cost || 0,
              unit_price: item.unitPrice || 0,
              item_type: item.itemType || null,
              suspended: item.suspended || false,
              opt_lock: item.optLock || 0,
              raw_data: item
            };

            // Extract warehouse details
            const warehouseDetails = (item.detailWarehouseData || []).map(w => ({
              warehouse_id: w.id,
              warehouse_name: w.warehouseName || w.name,
              location_id: w.locationId,
              unit1_quantity: w.unit1Quantity || 0,
              balance: w.balance || 0,
              balance_unit: w.balanceUnit || null,
              default_warehouse: w.defaultWarehouse || false,
              scrap_warehouse: w.scrapWarehouse || false,
              suspended: w.suspended || false,
              description: w.description || null,
              pic: w.pic || null,
              opt_lock: w.optLock || 0
            }));

            // Extract selling prices
            const sellingPrices = (item.detailSellingPrice || []).map(p => ({
              unit_id: p.unit?.id || null,
              unit_name: p.unit?.name || null,
              price: p.price || 0,
              price_category_id: p.priceCategory?.id || null,
              price_category_name: p.priceCategory?.name || null,
              currency_code: p.currency?.code || null,
              currency_symbol: p.currency?.symbol || null,
              branch_id: p.branch?.id || null,
              branch_name: p.branch?.name || null,
              effective_date: p.effectiveDate ? p.effectiveDate.split(' ')[0] : null,
              opt_lock: p.optLock || 0
            }));

            // Save to database
            try {
              await goodsModel.create(goodsData, warehouseDetails, sellingPrices);
              saved++;
            } catch (createErr) {
              console.error(`❌ Error saving item ${item.id} (${item.no}):`, createErr.message);
              console.error(`   Details:`, createErr);
              errors++;
            }
          } catch (err) {
            console.error(`❌ Error processing item ${item.id}:`, err.message);
            errors++;
          }
          
          processed++;
          if (processed % 10 === 0) {
            const progress = Math.round((processed / allItems.length) * 100);
            console.log(`⏳ Progress: ${processed}/${allItems.length} (${progress}%)`);
          }
        }

        // Delay between batches
        if (i + batchSize < allItems.length) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      const duration = Date.now() - startTime;
      const durationSec = (duration / 1000).toFixed(2);

      console.log(`✅ Sync complete: ${saved} saved, ${errors} errors in ${durationSec}s`);

      return reply.send({
        success: true,
        branch: {
          id: branch.id,
          name: branch.name
        },
        results: {
          total: allItems.length,
          saved,
          errors,
          processed,
          duration: `${durationSec}s`
        }
      });
    } catch (error) {
      console.error('Error in sync:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Get all goods
  async getAll(request, reply) {
    try {
      const { 
        category_id, 
        item_type, 
        suspended,
        search,
        limit = 50,
        offset = 0
      } = request.query;

      const filters = {
        category_id,
        item_type,
        suspended: suspended !== undefined ? suspended === 'true' : undefined,
        search,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const goods = await goodsModel.list(filters);
      
      return reply.send({
        success: true,
        data: goods,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          count: goods.length
        }
      });
    } catch (error) {
      console.error('Error in getAll:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Get goods by ID
  async getById(request, reply) {
    try {
      const { id } = request.params;

      const goods = await goodsModel.getById(parseInt(id));
      
      if (!goods) {
        return reply.code(404).send({ error: 'Goods not found' });
      }

      return reply.send({
        success: true,
        data: goods
      });
    } catch (error) {
      console.error('Error in getById:', error);
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  // Get summary statistics
  async getSummary(request, reply) {
    try {
      const { category_id, suspended } = request.query;

      const filters = {
        category_id,
        suspended: suspended !== undefined ? suspended === 'true' : undefined
      };

      const summary = await goodsModel.getSummary(filters);
      const warehouseSummary = await goodsModel.getWarehouseSummary();

      return reply.send({
        success: true,
        data: {
          byType: summary,
          byWarehouse: warehouseSummary
        }
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

module.exports = goodsController;
