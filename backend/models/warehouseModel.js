const { pool } = require('../config/database');

const warehouseModel = {
  // Get all warehouses from database
  async getAllWarehouses() {
    const query = {
      text: `
        SELECT 
          warehouse_id,
          warehouse_name,
          location_id,
          pic,
          suspended,
          default_warehouse,
          scrap_warehouse,
          description,
          created_at,
          updated_at
        FROM warehouses
        ORDER BY warehouse_name ASC
      `
    };

    const { rows } = await pool.query(query);
    return rows;
  },

  // Get warehouse by ID
  async getWarehouseById(warehouseId) {
    const query = {
      text: `
        SELECT 
          warehouse_id,
          warehouse_name,
          location_id,
          pic,
          suspended,
          default_warehouse,
          scrap_warehouse,
          description,
          raw_data,
          created_at,
          updated_at
        FROM warehouses
        WHERE warehouse_id = $1
      `,
      values: [warehouseId]
    };

    const { rows } = await pool.query(query);
    return rows[0] || null;
  },

  // Sync warehouse data from Accurate API
  async syncWarehouse(warehouseData) {
    console.log('📦 Syncing warehouse data:', { id: warehouseData.id });
    
    // Process raw Accurate API data structure
    const { 
      id, 
      name, 
      locationId,
      pic,
      suspended,
      defaultWarehouse,
      scrapWarehouse,
      description
    } = warehouseData;

    console.log('🔍 Raw warehouse data structure:', {
      id,
      name,
      locationId,
      pic,
      suspended,
      defaultWarehouse,
      scrapWarehouse,
      description
    });

    // Extract and map data from raw API structure
    const warehouseId = id?.toString() || `WH-${id}`;
    const warehouseName = name || `Unknown Warehouse ${id}`;
    const locationIdFinal = locationId?.toString() || null;
    const picFinal = pic || null;
    const suspendedFinal = suspended || false;
    const defaultWarehouseFinal = defaultWarehouse || false;
    const scrapWarehouseFinal = scrapWarehouse || false;
    const descriptionFinal = description || null;

    const query = {
      text: `
        INSERT INTO warehouses (
          warehouse_id, warehouse_name, location_id, pic, suspended,
          default_warehouse, scrap_warehouse, description, raw_data, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
        ON CONFLICT (warehouse_id) 
        DO UPDATE SET
          warehouse_name = EXCLUDED.warehouse_name,
          location_id = EXCLUDED.location_id,
          pic = EXCLUDED.pic,
          suspended = EXCLUDED.suspended,
          default_warehouse = EXCLUDED.default_warehouse,
          scrap_warehouse = EXCLUDED.scrap_warehouse,
          description = EXCLUDED.description,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      values: [
        warehouseId,
        warehouseName,
        locationIdFinal,
        picFinal,
        suspendedFinal,
        defaultWarehouseFinal,
        scrapWarehouseFinal,
        descriptionFinal,
        warehouseData // Store full raw data
      ]
    };

    const { rows } = await pool.query(query);
    console.log('✅ Warehouse synced:', { warehouseId, warehouseName });
    return rows[0];
  },

  // Extract and sync warehouses from item data
  async syncWarehousesFromItems(itemsData) {
    const warehouseMap = new Map();
    
    // Collect unique warehouses from all items
    itemsData.forEach(item => {
      if (item.detailWarehouseData && Array.isArray(item.detailWarehouseData)) {
        item.detailWarehouseData.forEach(warehouse => {
          if (!warehouseMap.has(warehouse.id)) {
            warehouseMap.set(warehouse.id, {
              id: warehouse.id,
              name: warehouse.warehouseName,
              locationId: warehouse.locationId,
              pic: warehouse.pic,
              suspended: warehouse.suspended,
              defaultWarehouse: warehouse.defaultWarehouse,
              scrapWarehouse: warehouse.scrapWarehouse,
              description: warehouse.description
            });
          }
        });
      }
    });

    console.log(`📦 Found ${warehouseMap.size} unique warehouses to sync`);

    // Sync each warehouse
    const syncPromises = Array.from(warehouseMap.values()).map(warehouse => 
      this.syncWarehouse(warehouse).catch(error => {
        console.error(`❌ Error syncing warehouse ${warehouse.id}:`, error);
        return null;
      })
    );

    const results = await Promise.all(syncPromises);
    const successful = results.filter(result => result !== null);
    
    console.log(`✅ Successfully synced ${successful.length} warehouses`);
    return successful;
  },

  // Delete warehouse
  async deleteWarehouse(warehouseId) {
    const query = {
      text: 'DELETE FROM warehouses WHERE warehouse_id = $1 RETURNING *',
      values: [warehouseId]
    };

    const { rows } = await pool.query(query);
    return rows[0] || null;
  }
};

module.exports = warehouseModel;
