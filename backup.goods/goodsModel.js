const db = require('../config/database');

const goodsModel = {
  // Create goods with warehouse details and selling prices (transaction)
  async create(goodsData, warehouseDetails, sellingPrices) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert header
      const headerQuery = `
        INSERT INTO goods (
          goods_id, goods_no, goods_name, short_name,
          category_id, category_name,
          unit1_id, unit1_name, unit1_price,
          cost, unit_price,
          item_type, suspended, opt_lock, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (goods_id) 
        DO UPDATE SET
          goods_no = EXCLUDED.goods_no,
          goods_name = EXCLUDED.goods_name,
          short_name = EXCLUDED.short_name,
          category_name = EXCLUDED.category_name,
          unit1_price = EXCLUDED.unit1_price,
          cost = EXCLUDED.cost,
          unit_price = EXCLUDED.unit_price,
          suspended = EXCLUDED.suspended,
          opt_lock = EXCLUDED.opt_lock,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const headerValues = [
        goodsData.goods_id,
        goodsData.goods_no,
        goodsData.goods_name,
        goodsData.short_name || null,
        goodsData.category_id || null,
        goodsData.category_name || null,
        goodsData.unit1_id || null,
        goodsData.unit1_name || null,
        goodsData.unit1_price || 0,
        goodsData.cost || 0,
        goodsData.unit_price || 0,
        goodsData.item_type || null,
        goodsData.suspended || false,
        goodsData.opt_lock || 0,
        JSON.stringify(goodsData.raw_data || {})
      ];

      const headerResult = await client.query(headerQuery, headerValues);
      const goodsDbId = headerResult.rows[0].id;

      // Delete existing warehouse details (for update case)
      await client.query(
        'DELETE FROM goods_warehouse_details WHERE goods_id = $1',
        [goodsData.goods_id]
      );

      // Insert warehouse details
      if (warehouseDetails && warehouseDetails.length > 0) {
        const warehouseQuery = `
          INSERT INTO goods_warehouse_details (
            goods_id, warehouse_id, warehouse_name, location_id,
            unit1_quantity, balance, balance_unit,
            default_warehouse, scrap_warehouse, suspended,
            description, pic, opt_lock
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;

        for (const detail of warehouseDetails) {
          await client.query(warehouseQuery, [
            goodsData.goods_id,
            detail.warehouse_id || null,
            detail.warehouse_name || null,
            detail.location_id || null,
            detail.unit1_quantity || 0,
            detail.balance || 0,
            detail.balance_unit || null,
            detail.default_warehouse || false,
            detail.scrap_warehouse || false,
            detail.suspended || false,
            detail.description || null,
            detail.pic || null,
            detail.opt_lock || 0
          ]);
        }
      }

      // Delete existing selling prices (for update case)
      await client.query(
        'DELETE FROM goods_selling_prices WHERE goods_id = $1',
        [goodsData.goods_id]
      );

      // Insert selling prices
      if (sellingPrices && sellingPrices.length > 0) {
        const priceQuery = `
          INSERT INTO goods_selling_prices (
            goods_id, unit_id, unit_name, price,
            price_category_id, price_category_name,
            currency_code, currency_symbol,
            branch_id, branch_name,
            effective_date, opt_lock
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        for (const price of sellingPrices) {
          await client.query(priceQuery, [
            goodsData.goods_id,
            price.unit_id || null,
            price.unit_name || null,
            price.price || 0,
            price.price_category_id || null,
            price.price_category_name || null,
            price.currency_code || null,
            price.currency_symbol || null,
            price.branch_id || null,
            price.branch_name || null,
            price.effective_date || null,
            price.opt_lock || 0
          ]);
        }
      }

      await client.query('COMMIT');
      return goodsDbId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Get goods by ID with details
  async getById(id) {
    const goodsQuery = 'SELECT * FROM goods WHERE id = $1';
    const warehouseQuery = 'SELECT * FROM goods_warehouse_details WHERE goods_id = $1 ORDER BY id';
    const priceQuery = 'SELECT * FROM goods_selling_prices WHERE goods_id = $1 ORDER BY id';

    const goodsResult = await db.query(goodsQuery, [id]);
    
    if (goodsResult.rows.length === 0) {
      return null;
    }

    const goods = goodsResult.rows[0];
    const warehouseResult = await db.query(warehouseQuery, [goods.goods_id]);
    const priceResult = await db.query(priceQuery, [goods.goods_id]);

    return {
      ...goods,
      warehouseDetails: warehouseResult.rows,
      sellingPrices: priceResult.rows
    };
  },

  // Get existing goods for sync check (lightweight)
  async getExistingForSync() {
    const query = `
      SELECT 
        goods_id,
        goods_no,
        opt_lock,
        updated_at
      FROM goods 
      ORDER BY goods_id
    `;
    
    const result = await db.query(query);
    return result.rows;
  },

  // List goods with filters
  async list(filters = {}) {
    let query = 'SELECT * FROM goods WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (filters.category_id) {
      query += ` AND category_id = $${paramCount}`;
      params.push(filters.category_id);
      paramCount++;
    }

    if (filters.item_type) {
      query += ` AND item_type = $${paramCount}`;
      params.push(filters.item_type);
      paramCount++;
    }

    if (filters.suspended !== undefined) {
      query += ` AND suspended = $${paramCount}`;
      params.push(filters.suspended);
      paramCount++;
    }

    if (filters.search) {
      query += ` AND (goods_no ILIKE $${paramCount} OR goods_name ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    // Sorting
    query += ' ORDER BY goods_no ASC, id DESC';

    // Pagination
    if (filters.limit) {
      query += ` LIMIT $${paramCount}`;
      params.push(filters.limit);
      paramCount++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramCount}`;
      params.push(filters.offset);
      paramCount++;
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  // Get summary statistics
  async getSummary(filters = {}) {
    let query = `
      SELECT 
        item_type,
        COUNT(*) as goods_count,
        SUM(CASE WHEN suspended = false THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN suspended = true THEN 1 ELSE 0 END) as suspended_count,
        AVG(unit_price) as avg_price,
        MIN(unit_price) as min_price,
        MAX(unit_price) as max_price
      FROM goods
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.category_id) {
      query += ` AND category_id = $${paramCount}`;
      params.push(filters.category_id);
      paramCount++;
    }

    if (filters.suspended !== undefined) {
      query += ` AND suspended = $${paramCount}`;
      params.push(filters.suspended);
      paramCount++;
    }

    query += ' GROUP BY item_type ORDER BY item_type';

    const result = await db.query(query, params);
    return result.rows;
  },

  // Get warehouse summary
  async getWarehouseSummary(filters = {}) {
    let query = `
      SELECT 
        gwd.warehouse_id,
        gwd.warehouse_name,
        COUNT(DISTINCT gwd.goods_id) as goods_count,
        SUM(gwd.unit1_quantity) as total_quantity,
        SUM(gwd.balance) as total_balance
      FROM goods_warehouse_details gwd
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (filters.warehouse_id) {
      query += ` AND gwd.warehouse_id = $${paramCount}`;
      params.push(filters.warehouse_id);
      paramCount++;
    }

    query += ' GROUP BY gwd.warehouse_id, gwd.warehouse_name ORDER BY gwd.warehouse_name';

    const result = await db.query(query, params);
    return result.rows;
  },

  // Delete goods
  async delete(id) {
    const query = 'DELETE FROM goods WHERE id = $1 RETURNING id';
    const result = await db.query(query, [id]);
    return result.rows.length > 0;
  },

  // Get database client for transaction management
  async getClient() {
    return db.getClient();
  }
};

module.exports = goodsModel;
