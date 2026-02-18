const accurateService = require('../services/accurateService');
const stockOnHandModel = require('../models/stockOnHandModel');

const stockOnHandController = {
  /**
   * Fetch Stock on Hand per Warehouse from Accurate API
   */
  async fetchStockOnHand(request, reply) {
    const startTime = Date.now();
    
    try {
      const { branchId, itemFilter = 'active', stockFilter = 'hasStock', warehouseId } = request.query;

      if (!branchId) {
        return reply.code(400).send({ success: false, error: 'branchId is required' });
      }

      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        return reply.code(404).send({ success: false, error: 'Branch not found' });
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 STOCK ON HAND FETCH STARTED: ${branch.name}`);
      console.log(`📋 Filters: itemFilter=${itemFilter}, stockFilter=${stockFilter}, warehouseId=${warehouseId || 'all'}`);
      console.log(`${'='.repeat(60)}\n`);

      // Step 1: Get item list from item/list-stock.do
      console.log('📋 Step 1: Fetching item list from item/list-stock.do...');
      
      const allItems = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const listResult = await accurateService.fetchData(`item/list-stock`, branch.dbId, branchId, {
          'sp.page': page,
          'sp.pageSize': 100
        });
        
        if (listResult.s && listResult.d && listResult.d.length > 0) {
          allItems.push(...listResult.d);
          
          const sp = listResult.sp || {};
          const totalPages = sp.pageCount || 1;
          
          console.log(`   Page ${page}/${totalPages}: ${listResult.d.length} items`);
          
          if (page >= totalPages) {
            hasMore = false;
          } else {
            page++;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } else {
          hasMore = false;
        }
      }
      
      console.log(`✅ Total items fetched: ${allItems.length}`);

      // Step 2: Filter items
      console.log('\n📋 Step 2: Filtering items...');
      
      let filteredItems = allItems;
      
      if (stockFilter === 'hasStock') {
        filteredItems = filteredItems.filter(item => item.quantity !== 0);
        console.log(`   After stock filter (quantity != 0): ${filteredItems.length} items`);
      }
      
      console.log(`✅ Items to process: ${filteredItems.length}`);

      // Step 3: Get detail for each item (batch of 8, delay 500ms)
      console.log('\n📋 Step 3: Fetching item details for warehouse data...');
      
      const BATCH_SIZE = 8;
      const BATCH_DELAY = 500;
      const stockData = [];
      
      for (let i = 0; i < filteredItems.length; i += BATCH_SIZE) {
        const batch = filteredItems.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(filteredItems.length / BATCH_SIZE);
        
        console.log(`   Batch ${batchNum}/${totalBatches}: Processing ${batch.length} items...`);
        
        const batchPromises = batch.map(async (item) => {
          try {
            const detailResult = await accurateService.fetchDetail('item', item.id, branch.dbId, branchId);
            
            if (detailResult.s && detailResult.d) {
              const detail = detailResult.d;
              const warehouseData = detail.detailWarehouseData || [];
              
              let warehouses = warehouseData;
              if (warehouseId) {
                warehouses = warehouseData.filter(wh => wh.id === parseInt(warehouseId));
              }
              
              if (itemFilter === 'active' && detail.suspended) {
                return [];
              }
              
              return warehouses
                .filter(wh => {
                  if (stockFilter === 'hasStock') {
                    return wh.balance !== 0;
                  }
                  return true;
                })
                .map(wh => ({
                  itemId: item.id,
                  itemNo: item.no || detail.no,
                  itemName: item.name || detail.name,
                  category: detail.itemCategory?.name || '',
                  unitName: detail.unit1Name || 'PCS',
                  warehouseId: wh.id,
                  warehouseName: wh.warehouseName || wh.name,
                  quantity: wh.balance,
                  balanceUnit: wh.balanceUnit
                }));
            }
            return [];
          } catch (err) {
            console.error(`   ❌ Error fetching detail for item ${item.id}:`, err.message);
            return [];
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(items => stockData.push(...items));
        
        if (i + BATCH_SIZE < filteredItems.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Check sync status with database
      console.log('\n📋 Step 4: Checking sync status with database...');
      const syncStatus = await stockOnHandModel.checkSyncStatus(stockData, branchId);
      
      // Add status to each item
      const dataWithStatus = stockData.map(item => {
        const key = `${item.itemId}-${item.warehouseId}`;
        const isNew = syncStatus.new.some(n => `${n.itemId}-${n.warehouseId}` === key);
        const updatedItem = syncStatus.updated.find(u => `${u.itemId}-${u.warehouseId}` === key);
        
        return {
          ...item,
          syncStatus: isNew ? 'new' : (updatedItem ? 'updated' : 'unchanged'),
          previousQuantity: updatedItem?.previousQuantity || null
        };
      });

      console.log(`\n${'='.repeat(60)}`);
      console.log(`✅ STOCK ON HAND FETCH COMPLETED`);
      console.log(`📊 Total stock records: ${stockData.length}`);
      console.log(`🆕 New: ${syncStatus.summary.new}, 🔄 Updated: ${syncStatus.summary.updated}, ✅ Unchanged: ${syncStatus.summary.unchanged}`);
      console.log(`⏱️ Duration: ${duration}s`);
      console.log(`${'='.repeat(60)}\n`);

      return reply.send({
        success: true,
        data: dataWithStatus,
        summary: {
          totalItems: filteredItems.length,
          totalRecords: stockData.length,
          duration: `${duration}s`
        },
        syncStatus: syncStatus.summary
      });

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`\n❌ STOCK ON HAND FETCH FAILED after ${duration}s:`, error.message);
      return reply.code(500).send({ 
        success: false,
        error: 'Internal server error',
        message: error.message 
      });
    }
  },

  /**
   * Check sync status - compare API data with database
   */
  async checkSyncStatus(request, reply) {
    try {
      const { branchId } = request.query;

      if (!branchId) {
        return reply.code(400).send({ success: false, error: 'branchId is required' });
      }

      // Get summary from database
      const summary = await stockOnHandModel.getSummary(branchId);

      return reply.send({
        success: true,
        data: summary
      });

    } catch (error) {
      console.error('Check sync status error:', error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  },

  /**
   * Save fetched data to database
   */
  async saveToDatabase(request, reply) {
    const startTime = Date.now();
    
    try {
      const { branchId, data } = request.body;

      if (!branchId) {
        return reply.code(400).send({ success: false, error: 'branchId is required' });
      }

      if (!data || !Array.isArray(data) || data.length === 0) {
        return reply.code(400).send({ success: false, error: 'data is required and must be non-empty array' });
      }

      console.log(`\n📥 Saving ${data.length} stock records to database for branch ${branchId}...`);

      // Check sync status first
      const syncStatus = await stockOnHandModel.checkSyncStatus(data, branchId);
      
      console.log(`   New: ${syncStatus.summary.new}, Updated: ${syncStatus.summary.updated}, Unchanged: ${syncStatus.summary.unchanged}`);

      // Only save new and updated records
      const recordsToSave = [...syncStatus.new, ...syncStatus.updated];
      
      if (recordsToSave.length === 0) {
        return reply.send({
          success: true,
          message: 'No changes to save',
          summary: syncStatus.summary,
          duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
        });
      }

      // Bulk upsert
      const results = await stockOnHandModel.bulkUpsert(recordsToSave, branchId);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`✅ Save completed: inserted=${results.inserted}, updated=${results.updated}`);

      return reply.send({
        success: true,
        message: `Saved ${recordsToSave.length} records`,
        summary: {
          ...syncStatus.summary,
          saved: recordsToSave.length,
          inserted: results.inserted,
          updated: results.updated
        },
        duration: `${duration}s`
      });

    } catch (error) {
      console.error('Save to database error:', error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  },

  /**
   * Get stock on hand from database
   */
  async getFromDatabase(request, reply) {
    try {
      const { branchId, warehouseId, itemNo, itemName, hasStock, limit, offset } = request.query;

      if (!branchId) {
        return reply.code(400).send({ success: false, error: 'branchId is required' });
      }

      const filters = {
        branchId,
        warehouseId: warehouseId || null,
        itemNo: itemNo || null,
        itemName: itemName || null,
        hasStock: hasStock === 'true',
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : null
      };

      const data = await stockOnHandModel.list(filters);
      const summary = await stockOnHandModel.getSummary(branchId);

      return reply.send({
        success: true,
        data,
        summary,
        count: data.length
      });

    } catch (error) {
      console.error('Get from database error:', error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  },

  /**
   * Get warehouses list from database
   */
  async getWarehouses(request, reply) {
    try {
      const { branchId } = request.query;

      if (!branchId) {
        return reply.code(400).send({ success: false, error: 'branchId is required' });
      }

      const warehouses = await stockOnHandModel.getWarehouses(branchId);

      return reply.send({
        success: true,
        data: warehouses
      });

    } catch (error) {
      console.error('Get warehouses error:', error.message);
      return reply.code(500).send({ success: false, error: error.message });
    }
  }
};

module.exports = stockOnHandController;
