const db = require('../config/database');

const stockOnHandModel = {
  /**
   * Upsert stock on hand record
   */
  async upsert(record) {
    const query = `
      INSERT INTO stock_on_hand (
        item_id, item_no, item_name, category, unit_name,
        warehouse_id, warehouse_name, branch_id,
        quantity, balance_unit, last_fetched_at, last_changed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, $11
      )
      ON CONFLICT (item_id, warehouse_id, branch_id)
      DO UPDATE SET
        item_no = EXCLUDED.item_no,
        item_name = EXCLUDED.item_name,
        category = EXCLUDED.category,
        unit_name = EXCLUDED.unit_name,
        warehouse_name = EXCLUDED.warehouse_name,
        quantity = EXCLUDED.quantity,
        balance_unit = EXCLUDED.balance_unit,
        last_fetched_at = CURRENT_TIMESTAMP,
        last_changed_at = CASE 
          WHEN stock_on_hand.quantity != EXCLUDED.quantity THEN CURRENT_TIMESTAMP
          ELSE stock_on_hand.last_changed_at
        END,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, 
        (xmax = 0) as is_new,
        (stock_on_hand.quantity != $9) as quantity_changed`;

    const values = [
      record.itemId,
      record.itemNo,
      record.itemName,
      record.category || null,
      record.unitName || 'PCS',
      record.warehouseId,
      record.warehouseName,
      record.branchId,
      record.quantity,
      record.balanceUnit || null,
      record.quantityChanged ? new Date() : null
    ];

    const res = await db.query(query, values);
    return res.rows[0];
  },

  /**
   * Bulk upsert records
   */
  async bulkUpsert(records = [], branchId) {
    const results = { inserted: 0, updated: 0, unchanged: 0 };
    
    for (const record of records) {
      const result = await this.upsert({ ...record, branchId });
      if (result.is_new) {
        results.inserted++;
      } else if (result.quantity_changed) {
        results.updated++;
      } else {
        results.unchanged++;
      }
    }
    
    return results;
  },

  /**
   * Get stock on hand from database
   */
  async list(filters = {}) {
    let query = 'SELECT * FROM stock_on_hand WHERE 1=1';
    const params = [];
    let i = 1;

    if (filters.branchId) {
      query += ` AND branch_id = $${i++}`;
      params.push(filters.branchId);
    }

    if (filters.warehouseId) {
      query += ` AND warehouse_id = $${i++}`;
      params.push(filters.warehouseId);
    }

    if (filters.itemNo) {
      query += ` AND item_no ILIKE $${i++}`;
      params.push(`%${filters.itemNo}%`);
    }

    if (filters.itemName) {
      query += ` AND item_name ILIKE $${i++}`;
      params.push(`%${filters.itemName}%`);
    }

    if (filters.hasStock) {
      query += ` AND quantity != 0`;
    }

    query += ' ORDER BY warehouse_name, item_name';

    if (filters.limit) {
      query += ` LIMIT $${i++}`;
      params.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET $${i++}`;
      params.push(filters.offset);
    }

    const res = await db.query(query, params);
    return res.rows;
  },

  /**
   * Get summary/metadata
   */
  async getSummary(branchId) {
    const query = `
      SELECT 
        COUNT(*) as total_records,
        COUNT(DISTINCT item_id) as total_items,
        COUNT(DISTINCT warehouse_id) as total_warehouses,
        SUM(CASE WHEN quantity > 0 THEN 1 ELSE 0 END) as positive_stock,
        SUM(CASE WHEN quantity < 0 THEN 1 ELSE 0 END) as negative_stock,
        SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) as zero_stock,
        MAX(last_fetched_at) as last_fetched_at,
        MAX(last_changed_at) as last_changed_at
      FROM stock_on_hand
      WHERE branch_id = $1
    `;

    const res = await db.query(query, [branchId]);
    return res.rows[0];
  },

  /**
   * Check sync status - compare incoming data with existing
   */
  async checkSyncStatus(incomingData = [], branchId) {
    // Get existing data from database
    const existing = await this.list({ branchId });
    
    const existingMap = new Map();
    existing.forEach(record => {
      const key = `${record.item_id}-${record.warehouse_id}`;
      existingMap.set(key, record);
    });

    const result = {
      new: [],
      updated: [],
      unchanged: [],
      summary: { new: 0, updated: 0, unchanged: 0, total: incomingData.length }
    };

    for (const incoming of incomingData) {
      const key = `${incoming.itemId}-${incoming.warehouseId}`;
      const existingRecord = existingMap.get(key);

      if (!existingRecord) {
        result.new.push(incoming);
        result.summary.new++;
      } else if (parseFloat(existingRecord.quantity) !== parseFloat(incoming.quantity)) {
        result.updated.push({
          ...incoming,
          previousQuantity: existingRecord.quantity,
          lastChangedAt: existingRecord.last_changed_at
        });
        result.summary.updated++;
      } else {
        result.unchanged.push(incoming);
        result.summary.unchanged++;
      }
    }

    return result;
  },

  /**
   * Get warehouses list from existing data
   */
  async getWarehouses(branchId) {
    const query = `
      SELECT DISTINCT warehouse_id, warehouse_name
      FROM stock_on_hand
      WHERE branch_id = $1
      ORDER BY warehouse_name
    `;
    const res = await db.query(query, [branchId]);
    return res.rows;
  }
};

module.exports = stockOnHandModel;
