const db = require('../config/database');

const purchaseOrderModel = {
  // Create or update purchase order header + items
  async create(orderData, items = []) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert / update header
      const headerQuery = `
        INSERT INTO purchase_orders (
          order_id, order_number, branch_id, branch_name,
          trans_date, ship_date,
          vendor_id, vendor_no, vendor_name,
          description, currency_code, rate,
          sub_total, tax_amount, total_amount,
          approval_status, status_name,
          payment_term_id, created_by, opt_lock, raw_data
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
        )
        ON CONFLICT (order_id, branch_id)
        DO UPDATE SET
          order_id        = EXCLUDED.order_id,
          trans_date      = EXCLUDED.trans_date,
          ship_date       = EXCLUDED.ship_date,
          vendor_name     = EXCLUDED.vendor_name,
          description     = EXCLUDED.description,
          currency_code   = EXCLUDED.currency_code,
          rate            = EXCLUDED.rate,
          sub_total       = EXCLUDED.sub_total,
          tax_amount      = EXCLUDED.tax_amount,
          total_amount    = EXCLUDED.total_amount,
          approval_status = EXCLUDED.approval_status,
          status_name     = EXCLUDED.status_name,
          payment_term_id = EXCLUDED.payment_term_id,
          opt_lock        = EXCLUDED.opt_lock,
          raw_data        = EXCLUDED.raw_data,
          updated_at      = CURRENT_TIMESTAMP
        RETURNING order_id
      `;

      const headerValues = [
        orderData.order_id,
        orderData.order_number,
        orderData.branch_id,
        orderData.branch_name,
        orderData.trans_date,
        orderData.ship_date,
        orderData.vendor_id || null,
        orderData.vendor_no || null,
        orderData.vendor_name || null,
        orderData.description || null,
        orderData.currency_code || null,
        orderData.rate || null,
        orderData.sub_total || 0,
        orderData.tax_amount || 0,
        orderData.total_amount || 0,
        orderData.approval_status || null,
        orderData.status_name || null,
        orderData.payment_term_id || null,
        orderData.created_by || null,
        orderData.opt_lock || 0,
        JSON.stringify(orderData.raw_data || {})
      ];

      const res = await client.query(headerQuery, headerValues);
      const dbHeaderId = res.rows[0].order_id;

      // Remove previous items for this order (idempotent update)
      //await client.query('DELETE FROM purchase_order_items WHERE order_id = $1', [orderData.order_id]);

      // Insert items
      if (items && items.length > 0) {
        const itemQuery = `
          INSERT INTO purchase_order_items (
            order_id, order_number, branch_id,
            seq, item_id, item_no, item_name,
            quantity, unit_id, unit_name,
            unit_price, total_price, tax_rate,
            warehouse_id, warehouse_name, notes
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
          )
          ON CONFLICT (order_id, detail_id, branch_id,seq)
          DO UPDATE SET
          order_number = EXCLUDED.order_number,
          item_no = EXCLUDED.item_no,
          item_name = EXCLUDED.item_name,
          quantity = EXCLUDED.quantity,
          unit_name = EXCLUDED.unit_name,
          unit_price = EXCLUDED.unit_price,
          discount = EXCLUDED.discount,
          amount = EXCLUDED.amount,
          warehouse_name = EXCLUDED.warehouse_name,
          item_category = EXCLUDED.item_category
        `;

        for (const item of items) {
          await client.query(itemQuery, [
            orderData.order_id,
            orderData.order_number,
            orderData.branch_id,
            item.seq,
            item.item_id || null,
            item.item_no || null,
            item.item_name || null,
            item.quantity || 0,
            item.unit_id || null,
            item.unit_name || null,
            item.unit_price || 0,
            item.total_price || 0,
            item.tax_rate || null,
            item.warehouse_id || null,
            item.warehouse_name || null,
            item.notes || null
          ]);
        }
      }

      await client.query('COMMIT');
      return dbHeaderId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Get order by internal id with items
  async getById(id) {
    const headerQuery = 'SELECT * FROM purchase_orders WHERE id = $1';
    const headerRes = await db.query(headerQuery, [id]);
    if (headerRes.rows.length === 0) return null;

    const orderId = headerRes.rows[0].order_id;
    const itemsQuery = 'SELECT * FROM purchase_order_items WHERE order_id = $1 ORDER BY id';
    const itemsRes = await db.query(itemsQuery, [orderId]);

    return { ...headerRes.rows[0], items: itemsRes.rows };
  },

  // Lightweight list for sync check
  async getExistingForSync(branchId, dateFrom, dateTo) {
    const q = `
      SELECT order_id, order_number, opt_lock, updated_at
      FROM purchase_orders
      WHERE branch_id = $1 AND trans_date BETWEEN $2 AND $3
      ORDER BY order_number`;
    const res = await db.query(q, [branchId, dateFrom, dateTo]);
    return res.rows;
  },

  // List with filters
  async list(filters = {}) {
    let q = 'SELECT * FROM purchase_orders WHERE 1=1';
    const params = [];
    let i = 1;

    if (filters.branch_id) { q += ` AND branch_id = $${i++}`; params.push(filters.branch_id); }
    if (filters.date_from) { q += ` AND trans_date >= $${i++}`; params.push(filters.date_from); }
    if (filters.date_to)   { q += ` AND trans_date <= $${i++}`; params.push(filters.date_to); }
    if (filters.vendor_no) { q += ` AND vendor_no = $${i++}`; params.push(filters.vendor_no); }

    q += ' ORDER BY trans_date DESC, id DESC';

    if (filters.limit)  { q += ` LIMIT $${i++}`; params.push(filters.limit); }
    if (filters.offset) { q += ` OFFSET $${i++}`; params.push(filters.offset); }

    const res = await db.query(q, params);
    return res.rows;
  },

  // Summary
  async getSummary(filters = {}) {
    let q = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_amount,
        AVG(total_amount) as avg_amount,
        MIN(trans_date) as earliest_date,
        MAX(trans_date) as latest_date
      FROM purchase_orders WHERE 1=1`;
    const params = [];
    let i = 1;

    if (filters.branch_id) { q += ` AND branch_id = $${i++}`; params.push(filters.branch_id); }
    if (filters.date_from) { q += ` AND trans_date >= $${i++}`; params.push(filters.date_from); }
    if (filters.date_to)   { q += ` AND trans_date <= $${i++}`; params.push(filters.date_to); }

    const res = await db.query(q, params);
    return res.rows[0];
  }
};

module.exports = purchaseOrderModel;
