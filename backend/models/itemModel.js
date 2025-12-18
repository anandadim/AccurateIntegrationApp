const { pool } = require('../config/database');
const warehouseModel = require('./warehouseModel');

const itemModel = {
  // Get all items from database
  async getAllItems() {
    const query = {
      text: `
        SELECT 
          item_id,
          item_no,
          name,
          branch_id,
          category_name,
          type,
          stock,
          warehouse,
          unit_name,
          brand,
          tax1_rate,
          tax2_rate,
          tax_included,
          suspended,
          updated_at,
          created_at
        FROM items
        ORDER BY updated_at DESC
      `
    };

    const { rows } = await pool.query(query);
    return rows;
  },

  // Get item by ID with warehouse stock
  async getItemWithStock(itemId, warehouseId = null) {
    const query = {
      text: `
        SELECT 
          i.item_id as id,
          i.item_no as "itemNo",
          i.name as "itemName",
          i.category_name as "category",
          i.type as "itemType",
          i.stock as "itemCode",
          i.warehouse as "warehouse",
          i.unit_name as "unit",
          i.brand as "brand",
          i.suspended as "suspended",
          json_build_object(
            'isTaxIncluded', i.tax_included,
            'tax1Rate', i.tax1_rate,
            'tax2Rate', i.tax2_rate
          ) as tax,
          COALESCE(ws.stock_quantity, 0) as stock,
          i.raw_data as "rawData"
        FROM items i
        LEFT JOIN warehouse_stock ws ON i.item_id = ws.item_id
        ${warehouseId ? 'AND ws.warehouse_id = $2' : ''}
        WHERE i.item_id = $1
        ${warehouseId ? '' : 'ORDER BY ws.warehouse_name'}
      `,
      values: warehouseId ? [itemId, warehouseId] : [itemId]
    };

    const { rows } = await pool.query(query);
    return rows[0] || null;
  },

  // Get all warehouses with stock for an item
  async getItemWarehouseStock(itemId) {
    const query = {
      text: `
        SELECT 
          ws.warehouse_id as "warehouseId",
          ws.warehouse_name as "warehouseName",
          ws.stock_quantity as "stockQuantity",
          ws.last_updated as "lastUpdated"
        FROM warehouse_stock ws
        WHERE ws.item_id = $1
        ORDER BY ws.warehouse_name
      `,
      values: [itemId]
    };

    const { rows } = await pool.query(query);
    return rows;
  },

  // Sync item data from Accurate API
  async syncItem(itemData, branchId = null) {
    console.log('📦 Syncing item data:', { id: itemData.id, branchId });
    
    // Process raw Accurate API data structure
    const { 
      id, 
      no, 
      name, 
      shortName,
      itemCategory,
      itemTypeName,
      itemType,  // Direct field from API
      barcode,
      unit1,
      unit1Name,
      unit1Id,
      itemBrand,
      brand,
      itemBrandId,  // Direct field from API
      tax1Id,
      tax2Id,
      percentTaxable,
      taxIncluded,
      balance,
      itemCategoryId,
      suspended,
      detailWarehouseData,
      seq
    } = itemData;

    console.log('🔍 Raw item data structure:', {
      id,
      no,
      name,
      shortName,
      hasItemCategory: !!itemCategory,
      itemTypeName,
      itemType,  // Check this field
      hasUnit1: !!unit1,
      unit1Name,
      unit1Id,
      hasItemBrand: !!itemBrand,
      itemBrandId,  // Check this field
      tax1Id,
      tax2Id,
      percentTaxable,
      balance,
      itemCategoryId,
      warehouseCount: detailWarehouseData?.length || 0
    });

    // Extract and map data from raw API structure
    const itemNo = no || `ITEM-${id}`;                    // No / ID
    const itemName = name || shortName || `Unknown Item ${id}`; // Nama Barang
    const categoryName = itemCategory?.name || null;      // Kategori Barang  
    const itemCategoryIdValue = itemCategoryId || itemCategory?.id || null; // ID Kategori
    const itemTypeNameFinal = itemTypeName || itemType || null; // Jenis Barang (try both fields)
    const unitName = unit1?.name || unit1Name || null;    // Satuan
    const brandName = itemBrand?.name || brand?.name || null; // Merk Barang
    
    // Extract warehouse name from detailWarehouseData
    let warehouseName = null;
    if (detailWarehouseData && Array.isArray(detailWarehouseData) && detailWarehouseData.length > 0) {
      // Ambil warehouse default (defaultWarehouse: true) atau warehouse pertama
      const defaultWarehouse = detailWarehouseData.find(wh => wh.defaultWarehouse === true);
      warehouseName = defaultWarehouse ? defaultWarehouse.warehouseName : detailWarehouseData[0].warehouseName;
    }
    const warehouse = warehouseName || null; // Gudang
    
    // Extract tax information
    let tax1Rate = 0;
    let tax2Rate = 0;
    if (percentTaxable && percentTaxable !== 100) {
      tax1Rate = percentTaxable; // Use percentTaxable if not 100%
    }
    
    const stockQuantity = balance || 0;                   // Stok

    // // Extract warehouse name from detailWarehouseData
    // let warehouseName = null;
    // if (detailWarehouseData && Array.isArray(detailWarehouseData) && detailWarehouseData.length > 0) {
    //   // Take first warehouse to get variety of warehouses
    //   warehouseName = detailWarehouseData[0].warehouseName;
    // }

    // console.log('🔍 Warehouse name extracted:', { 
    //   warehouseName, 
    //   warehouseCount: detailWarehouseData?.length || 0,
    //   allWarehouses: detailWarehouseData?.map(wh => wh.warehouseName) || []
    // });

    const query = {
      text: `
        INSERT INTO items (
          item_id, item_no, seq, branch_id, name, category_name, type, 
          stock, warehouse, unit_name, brand, tax1_rate, tax2_rate, 
          tax_included, suspended, item_category_id, raw_data, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP)
        ON CONFLICT (item_id, branch_id, seq) 
        DO UPDATE SET
          item_no = EXCLUDED.item_no,
          name = EXCLUDED.name,
          category_name = EXCLUDED.category_name,
          type = EXCLUDED.type,
          stock = EXCLUDED.stock,
          warehouse = EXCLUDED.warehouse,
          unit_name = EXCLUDED.unit_name,
          brand = EXCLUDED.brand,
          tax1_rate = EXCLUDED.tax1_rate,
          tax2_rate = EXCLUDED.tax2_rate,
          tax_included = EXCLUDED.tax_included,
          item_category_id = EXCLUDED.item_category_id,
          suspended = EXCLUDED.suspended,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      values: [
        id,
        itemNo,
        seq || 0,
        branchId || '',
        itemName,
        categoryName,
        itemTypeNameFinal,
        stockQuantity,
        warehouse || '',
        unitName,
        brandName,
        tax1Rate,
        tax2Rate,
        taxIncluded || false,
        suspended || false,
        itemCategoryIdValue,
        itemData
      ]
    };

    const { rows } = await pool.query(query);
    console.log('✅ Item synced:', { itemNo, itemName });
    return rows[0];
  },

  // Sync multiple items and extract warehouses
  async syncItemsWithWarehouses(itemsData) {
    console.log(`📦 Syncing ${itemsData.length} items with warehouses...`);
    
    // First, sync all warehouses from the items data
    const warehouses = await warehouseModel.syncWarehousesFromItems(itemsData);
    
    // Then sync all items
    const syncPromises = itemsData.map(item => 
      this.syncItem(item).catch(error => {
        console.error(`❌ Error syncing item ${item.id}:`, error);
        return null;
      })
    );

    const results = await Promise.all(syncPromises);
    const successful = results.filter(result => result !== null);
    
    console.log(`✅ Successfully synced ${successful.length} items and ${warehouses.length} warehouses`);
    
    return {
      items: successful,
      warehouses: warehouses
    };
  },

    async getExistingForSync(branchId) {
    const query = `
      SELECT 
        item_id,
        item_no,
        updated_at
      FROM items 
      WHERE branch_id = $1 
      ORDER BY item_id
    `;
    
    const result = await pool.query(query, [branchId]);
    return result.rows;
  },

  // Update warehouse stock
  async updateWarehouseStock(itemId, warehouseId, warehouseName, quantity) {
    const query = {
      text: `
        INSERT INTO warehouse_stock 
          (item_id, warehouse_id, warehouse_name, stock_quantity)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (item_id, warehouse_id) 
        DO UPDATE SET
          stock_quantity = EXCLUDED.stock_quantity,
          warehouse_name = EXCLUDED.warehouse_name,
          last_updated = CURRENT_TIMESTAMP
        RETURNING *
      `,
      values: [itemId, warehouseId, warehouseName, quantity]
    };

    const { rows } = await pool.query(query);
    return rows[0];
  }
};

module.exports = itemModel;
