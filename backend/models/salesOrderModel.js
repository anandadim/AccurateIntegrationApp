const { pool } = require('../config/database');

const salesOrderModel = {
  // Create or update sales order with items
  async create(headerData, items = []) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Upsert header
      const headerQuery = `
        INSERT INTO sales_orders (
          order_id, order_number, branch_id, branch_name,
          trans_date, delivery_date, po_number,
          customer_id, customer_name, customer_address,
          salesman_id, salesman_name,
          warehouse_id, warehouse_name,
          subtotal, discount, tax, total,
          order_status, opt_lock, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (order_id) 
        DO UPDATE SET
          order_number = EXCLUDED.order_number,
          branch_id = EXCLUDED.branch_id,
          branch_name = EXCLUDED.branch_name,
          trans_date = EXCLUDED.trans_date,
          delivery_date = EXCLUDED.delivery_date,
          po_number = EXCLUDED.po_number,
          customer_id = EXCLUDED.customer_id,
          customer_name = EXCLUDED.customer_name,
          customer_address = EXCLUDED.customer_address,
          salesman_id = EXCLUDED.salesman_id,
          salesman_name = EXCLUDED.salesman_name,
          warehouse_id = EXCLUDED.warehouse_id,
          warehouse_name = EXCLUDED.warehouse_name,
          subtotal = EXCLUDED.subtotal,
          discount = EXCLUDED.discount,
          tax = EXCLUDED.tax,
          total = EXCLUDED.total,
          order_status = EXCLUDED.order_status,
          opt_lock = EXCLUDED.opt_lock,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, order_id;
      `;

      const headerValues = [
        headerData.order_id,
        headerData.order_number,
        headerData.branch_id,
        headerData.branch_name,
        headerData.trans_date,
        headerData.delivery_date,
        headerData.po_number,
        headerData.customer_id,
        headerData.customer_name,
        headerData.customer_address,
        headerData.salesman_id,
        headerData.salesman_name,
        headerData.warehouse_id,
        headerData.warehouse_name,
        headerData.subtotal,
        headerData.discount,
        headerData.tax,
        headerData.total,
        headerData.order_status,
        headerData.opt_lock || 0,
        headerData.raw_data
      ];

      const headerResult = await client.query(headerQuery, headerValues);
      const orderId = headerResult.rows[0].order_id;

      // Delete existing items
      await client.query('DELETE FROM sales_order_items WHERE order_id = $1', [orderId]);

      // Insert new items
      if (items && items.length > 0) {
        const itemQuery = `
          INSERT INTO sales_order_items (
            order_id, item_no, item_name,
            quantity, unit_name, unit_price, discount, amount,
            warehouse_name, warehouse_address, salesman_name, item_category, item_notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;

        for (const item of items) {
          const itemValues = [
            orderId,
            item.item_no,
            item.item_name,
            item.quantity,
            item.unit_name,
            item.unit_price,
            item.discount,
            item.amount,
            item.warehouse_name,
            item.warehouse_address,
            item.salesman_name,
            item.item_category,
            item.item_notes
          ];

          await client.query(itemQuery, itemValues);
        }
      }

      await client.query('COMMIT');
      return headerResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Get existing orders for sync check
  async getExistingForSync(branchId, dateFrom, dateTo) {
    const query = `
      SELECT order_id, order_number, opt_lock
      FROM sales_orders
      WHERE branch_id = $1
        AND trans_date >= $2
        AND trans_date <= $3
      ORDER BY trans_date DESC;
    `;

    const result = await pool.query(query, [branchId, dateFrom, dateTo]);
    return result.rows;
  },

  // List orders with filters
  async list(filters = {}) {
    let query = `
      SELECT 
        so.id, so.order_id, so.order_number,
        so.branch_id, so.branch_name,
        so.trans_date, so.delivery_date,
        so.customer_id, so.customer_name,
        so.salesman_id, so.salesman_name,
        so.subtotal, so.discount, so.tax, so.total,
        so.order_status,
        so.created_at, so.updated_at
      FROM sales_orders so
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (filters.branch_id) {
      query += ` AND so.branch_id = $${paramCount}`;
      params.push(filters.branch_id);
      paramCount++;
    }

    if (filters.date_from) {
      query += ` AND so.trans_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      query += ` AND so.trans_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    if (filters.customer_id) {
      query += ` AND so.customer_id = $${paramCount}`;
      params.push(filters.customer_id);
      paramCount++;
    }

    if (filters.order_status) {
      query += ` AND so.order_status = $${paramCount}`;
      params.push(filters.order_status);
      paramCount++;
    }

    query += ` ORDER BY so.trans_date DESC, so.order_number DESC`;

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

    const result = await pool.query(query, params);
    return result.rows;
  },

  // Get order by ID with items
  async getById(orderId) {
    const headerQuery = `
      SELECT * FROM sales_orders WHERE order_id = $1;
    `;

    const itemsQuery = `
      SELECT * FROM sales_order_items WHERE order_id = $1 ORDER BY id;
    `;

    const headerResult = await pool.query(headerQuery, [orderId]);
    
    if (headerResult.rows.length === 0) {
      return null;
    }

    const itemsResult = await pool.query(itemsQuery, [orderId]);

    return {
      ...headerResult.rows[0],
      items: itemsResult.rows
    };
  },

  // Get summary statistics
  async getSummary(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(DISTINCT customer_id) as total_customers,
        SUM(total) as total_amount,
        AVG(total) as avg_amount,
        MIN(trans_date) as earliest_date,
        MAX(trans_date) as latest_date
      FROM sales_orders
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (filters.branch_id) {
      query += ` AND branch_id = $${paramCount}`;
      params.push(filters.branch_id);
      paramCount++;
    }

    if (filters.date_from) {
      query += ` AND trans_date >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters.date_to) {
      query += ` AND trans_date <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    const result = await pool.query(query, params);
    return result.rows[0];
  }
};

module.exports = salesOrderModel;
