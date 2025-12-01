// Create this file at:
// d:\Gilang Magang SNJ\AccurateIntegrationApp\backend\controllers\itemController.js

const itemModel = require('../models/itemModel');
const accurateService = require('../services/accurateService');

const itemController = {
  // Get item details by ID
  async getItemDetails(request, reply) {
    try {
      const { id } = request.params;
      const { warehouse } = request.query;

      if (!id) {
        reply.code(400);
        return { success: false, error: 'Item ID is required' };
      }

      // Get item details
      const item = await itemModel.getItemWithStock(id, warehouse);
      
      if (!item) {
        reply.code(404);
        return { success: false, error: 'Item not found' };
      }

      // Get warehouse stock if warehouse is not specified
      if (!warehouse) {
        const warehouses = await itemModel.getItemWarehouseStock(id);
        item.warehouses = warehouses;
      }

      return {
        success: true,
        data: item
      };
    } catch (error) {
      console.error('Error fetching item details:', error);
      reply.code(500);
      return { 
        success: false, 
        error: error.message,
        details: error.response?.data || null
      };
    }
  },

  // Check item sync status (compare API vs DB)
  async checkSyncStatus(request, reply) {
    try {
      const { branchId } = request.query;
      
      // Get branch data to extract dbId
      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        reply.code(400);
        return { success: false, error: 'Invalid branch ID' };
      }

      const dbId = branch.dbId;

      // Get items from Accurate API
      const apiItems = await accurateService.fetchDataWithFilter('item/list', dbId, {
        'sp.pageSize': 1000
      }, branchId);
      
      console.log('📦 API Items Response:', { 
        type: typeof apiItems, 
        isArray: Array.isArray(apiItems), 
        length: apiItems?.length,
        data: apiItems 
      });
      
      // Handle different response formats
      let itemsArray = [];
      if (Array.isArray(apiItems)) {
        itemsArray = apiItems;
      } else if (apiItems && typeof apiItems === 'object') {
        // Check if it's paginated response with data array
        if (apiItems.d && Array.isArray(apiItems.d)) {
          itemsArray = apiItems.d;
        } else if (apiItems.data && Array.isArray(apiItems.data)) {
          itemsArray = apiItems.data;
        } else if (apiItems.items && Array.isArray(apiItems.items)) {
          itemsArray = apiItems.items;
        }
      }
      
      console.log('📦 Processed Items Array:', { 
        length: itemsArray.length,
        sample: itemsArray.slice(0, 2)
      });
      
      // Get items from database
      const dbItems = await itemModel.getAllItems();
      
      // Create maps for comparison
      const dbItemMap = new Map();
      dbItems.forEach(item => {
        dbItemMap.set(item.item_id, item);
      });

      // Compare and categorize
      const summary = {
        new: 0,
        updated: 0,
        unchanged: 0,
        total: itemsArray.length,
        needSync: 0
      };

      itemsArray.forEach(apiItem => {
        const dbItem = dbItemMap.get(apiItem.id);
        
        if (!dbItem) {
          summary.new++;
          summary.needSync++;
        } else {
          // Compare update timestamps
          const apiUpdatedAt = new Date(apiItem.updatedDate || apiItem.modifiedDate || apiItem.createdDate);
          const dbUpdatedAt = new Date(dbItem.updated_at);
          
          if (apiUpdatedAt > dbUpdatedAt) {
            summary.updated++;
            summary.needSync++;
          } else {
            summary.unchanged++;
          }
        }
      });
      
      return { success: true, summary };
    } catch (error) {
      console.error('Error checking item sync status:', error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  },

  // Smart sync items
  async syncItemsSmart(request, reply) {
    try {
      const { branchId, batchSize = 20, batchDelay = 300, mode = 'missing' } = request.query;
      
      // Get branch data to extract dbId
      const branches = accurateService.getBranches();
      const branch = branches.find(b => b.id === branchId);
      
      if (!branch) {
        reply.code(400);
        return { success: false, error: 'Invalid branch ID' };
      }

      const dbId = branch.dbId;

      // Get items list from Accurate API (basic info with IDs only)
      const apiItemsList = await accurateService.fetchDataWithFilter('item/list', dbId, {
        'sp.pageSize': 500
      }, branchId);
      
      // Handle different response formats
      let itemsListArray = [];
      if (Array.isArray(apiItemsList)) {
        itemsListArray = apiItemsList;
      } else if (apiItemsList && typeof apiItemsList === 'object') {
        if (apiItemsList.d && Array.isArray(apiItemsList.d)) {
          itemsListArray = apiItemsList.d;
        } else if (apiItemsList.data && Array.isArray(apiItemsList.data)) {
          itemsListArray = apiItemsList.data;
        } else if (apiItemsList.items && Array.isArray(apiItemsList.items)) {
          itemsListArray = apiItemsList.items;
        }
      }
      
      console.log(`📦 Found ${itemsListArray.length} items in list, fetching details...`);
      
      // Fetch complete details for each item (like invoice/sales pattern)
      const apiItems = [];
      const detailBatchSize = 10;
      for (let i = 0; i < itemsListArray.length; i += detailBatchSize) {
        const batch = itemsListArray.slice(i, i + detailBatchSize);
        console.log(`📦 Fetching details for batch ${Math.floor(i/detailBatchSize) + 1}/${Math.ceil(itemsListArray.length/detailBatchSize)} (${batch.length} items)`);
        
        const batchPromises = batch.map(item => 
          accurateService.fetchDetail('item', item.id, dbId, branchId)
            .catch(err => {
              console.error(`❌ Failed to fetch detail for item ${item.id}: ${err.message}`);
              return null;
            })
        );
        
        const batchDetails = await Promise.all(batchPromises);
        const validDetails = batchDetails.filter(detail => detail !== null);
        
        // Extract actual item data from nested response structure
        const processedDetails = validDetails.map(detail => {
          // Handle different response formats from fetchDetail
          if (detail && detail.d && typeof detail.d === 'object') {
            return detail.d; // Extract the actual item data
          }
          return detail; // Return as-is if already in correct format
        });
        
        apiItems.push(...processedDetails);
        
        // Small delay to avoid rate limiting
        if (i + detailBatchSize < itemsListArray.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`✅ Fetched complete details for ${apiItems.length} items`);
      
      // Get items from database
      const dbItems = await itemModel.getAllItems();
      
      // Create maps for comparison
      const dbItemMap = new Map();
      dbItems.forEach(item => {
        dbItemMap.set(item.item_id, item);
      });

      // Filter items based on mode
      let itemsToSync = [];
      
      if (mode === 'missing') {
        // Only sync new or updated items
        apiItems.forEach(apiItem => {
          const dbItem = dbItemMap.get(apiItem.id);
          
          if (!dbItem) {
            itemsToSync.push(apiItem);
          } else {
            // Compare update timestamps
            const apiUpdatedAt = new Date(apiItem.updatedDate || apiItem.modifiedDate || apiItem.createdDate);
            const dbUpdatedAt = new Date(dbItem.updated_at);
            
            if (apiUpdatedAt > dbUpdatedAt) {
              itemsToSync.push(apiItem);
            }
          }
        });
      } else if (mode === 'all') {
        // Sync all items
        itemsToSync = apiItems;
      } else {
        // Default to 'missing' mode
        itemsToSync = apiItems.filter(apiItem => {
          const dbItem = dbItemMap.get(apiItem.id);
          return !dbItem || new Date(apiItem.updatedDate || apiItem.modifiedDate || apiItem.createdDate) > new Date(dbItem.updated_at);
        });
      }

      // Process in batches
      const startTime = Date.now();
      let synced = 0;
      let fetchErrors = 0;
      let saveErrors = 0;

      console.log(`🚀 Starting item sync: ${itemsToSync.length} items in batches of ${batchSize}`);

      for (let i = 0; i < itemsToSync.length; i += batchSize) {
        const batch = itemsToSync.slice(i, i + batchSize);
        
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(itemsToSync.length/batchSize)} (${batch.length} items)`);
        
        // Process batch items
        for (const apiItem of batch) {
          try {
            // Log the raw API item structure for debugging
            console.log(`🔍 Raw API Item Structure for ID ${apiItem.id}:`, {
              availableFields: Object.keys(apiItem),
              hasNo: !!apiItem.no,
              hasName: !!apiItem.name,
              hasItemCategory: !!apiItem.itemCategory,
              hasItemTypeName: !!apiItem.itemTypeName,
              hasItemType: !!apiItem.itemType,
              hasUnit1: !!apiItem.unit1,
              hasUnit1Name: !!apiItem.unit1Name,
              hasItemBrand: !!apiItem.itemBrand,
              hasDetailWarehouseData: !!apiItem.detailWarehouseData,
              sampleData: {
                id: apiItem.id,
                no: apiItem.no,
                name: apiItem.name,
                itemCategory: apiItem.itemCategory?.name,
                itemTypeName: apiItem.itemTypeName,
                itemType: apiItem.itemType,
                unit1Name: apiItem.unit1Name,
                itemBrand: apiItem.itemBrand?.name,
                balance: apiItem.balance,
                warehouseCount: apiItem.detailWarehouseData?.length || 0
              }
            });
            
            // Save/update item in database
            await itemModel.syncItem(apiItem);
            synced++;
          } catch (error) {
            console.error(`Error saving item ${apiItem.id}:`, error);
            saveErrors++;
          }
        }

        // Delay between batches
        if (i + batchSize < itemsToSync.length && batchDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, batchDelay));
        }
      }

      const duration = `${Math.round((Date.now() - startTime) / 1000)}s`;
      
      const summary = {
        synced,
        fetchErrors,
        saveErrors,
        duration,
        total: itemsToSync.length
      };

      console.log(`✅ Item sync completed:`, summary);

      return { success: true, summary };
    } catch (error) {
      console.error('Error in smart item sync:', error);
      reply.code(500);
      return { success: false, error: error.message };
    }
  },

  // Sync item data from Accurate API
  async syncItem(request, reply) {
    try {
      const { id } = request.params;
      const { db, branch } = request.query;

      if (!id || !db) {
        reply.code(400);
        return { success: false, error: 'Item ID and database ID are required' };
      }

      // Fetch item data from Accurate API
      const itemData = await accurateService.fetchData(`item/${id}`, db, branch);
      
      if (!itemData) {
        reply.code(404);
        return { success: false, error: 'Item not found in Accurate' };
      }

      // Save/update item in database
      const savedItem = await itemModel.syncItem(itemData);

      return {
        success: true,
        data: savedItem,
        message: 'Item data synchronized successfully'
      };
    } catch (error) {
      console.error('Error syncing item:', error);
      reply.code(500);
      return { 
        success: false, 
        error: error.message,
        details: error.response?.data || null
      };
    }
  }
};

module.exports = itemController;