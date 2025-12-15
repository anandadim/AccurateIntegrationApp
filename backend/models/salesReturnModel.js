const db = require('../config/database');

const salesReturnModel = {
  // Create header + items transactionally
  async create(returnData, items = []) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert / update header
      const headerQuery = `
        INSERT INTO sales_returns (
          sales_return_id, return_number, branch_id, 
          branch_name,trans_date, invoice_id, 
          invoice_number, return_type,
          return_amount, sub_total, cash_discount,
          description, approval_status, customer_id,
          po_number, master_salesman_id, salesman_name, 
          currency_code, journal_id, created_by, raw_data
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
        )
        ON CONFLICT (sales_return_id, branch_id)
        DO UPDATE SET
          return_number     = EXCLUDED.return_number,
          invoice_id          = EXCLUDED.invoice_id,
          invoice_number      = EXCLUDED.invoice_number,
          return_type         = EXCLUDED.return_type,
          return_amount       = EXCLUDED.return_amount,
          sub_total           = EXCLUDED.sub_total,
          cash_discount       = EXCLUDED.cash_discount,
          description         = EXCLUDED.description,
          approval_status     = EXCLUDED.approval_status,
          customer_id         = EXCLUDED.customer_id,
          po_number           = EXCLUDED.po_number,
          master_salesman_id  = EXCLUDED.master_salesman_id,
          salesman_name       = EXCLUDED.salesman_name,
          currency_code       = EXCLUDED.currency_code,
          journal_id          = EXCLUDED.journal_id,
          raw_data            = EXCLUDED.raw_data,
          updated_at          = CURRENT_TIMESTAMP
        RETURNING id`;

      const headerValues = [
        returnData.sales_return_id,
        returnData.return_number,
        returnData.branch_id,
        returnData.branch_name,
        returnData.trans_date,
        returnData.invoice_id,
        returnData.invoice_number,
        returnData.return_type,
        returnData.return_amount,
        returnData.sub_total,
        returnData.cash_discount,
        returnData.description,
        returnData.approval_status,
        returnData.customer_id,
        returnData.po_number,
        returnData.master_salesman_id,
        returnData.salesman_name,
        returnData.currency_code,
        returnData.journal_id,
        returnData.created_by,
        JSON.stringify(returnData.raw_data || {})
      ];

      const headerRes = await client.query(headerQuery, headerValues);
      const dbHeaderId = headerRes.rows[0].id;

      // Remove existing items
      //await client.query('DELETE FROM sales_return_items WHERE sales_return_id = $1', [returnData.sales_return_id]);

      // Insert items if provided
      if (items && items.length > 0) {
        const itemQuery = `
          INSERT INTO sales_return_items (
            sales_return_id, branch_id, seq,
            item_id, item_no, item_name, quantity, unit_name,
            unit_price, return_amount,
            cogs_gl_account_id, warehouse_id, warehouse_name, cost_item,
            sales_invoice_detail_id, invoice_detail_quantity, sales_order_id, return_detail_status
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
          )
            ON CONFLICT (sales_return_id, branch_id,seq)
            DO UPDATE SET
              item_id = EXCLUDED.item_id, 
              item_no  = EXCLUDED.item_no, 
              item_name  = EXCLUDED.item_name, 
              quantity  = EXCLUDED.quantity, 
              unit_name = EXCLUDED.unit_name,
              unit_price = EXCLUDED.unit_price, 
              return_amount = EXCLUDED.return_amount,
              cogs_gl_account_id = EXCLUDED.cogs_gl_account_id, 
              warehouse_id = EXCLUDED.warehouse_id, 
              warehouse_name = EXCLUDED.warehouse_name, 
              cost_item = EXCLUDED.cost_item,
              sales_invoice_detail_id = EXCLUDED.sales_invoice_detail_id, 
              invoice_detail_quantity = EXCLUDED.invoice_detail_quantity, 
              sales_order_id = EXCLUDED.sales_order_id, 
              return_detail_status  = EXCLUDED.return_detail_status           

      `;

        for (const item of items) {
         const itemValues = [
            returnData.sales_return_id,
            returnData.branch_id,
            item.seq || 0, // Add seq parameter with default value
            item.item_id,
            item.item_no,
            item.item_name,
            item.quantity,
            item.unit_name,
            item.unit_price,
            item.return_amount,
            item.cogs_gl_account_id,
            item.warehouse_id,
            item.warehouse_name,
            item.cost_item,
            item.sales_invoice_detail_id,
            item.invoice_detail_quantity,
            item.sales_order_id,
            item.return_detail_status
          ];
          
          await client.query(itemQuery, itemValues);
        
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

  // Existing list for sync check
  async getExistingForSync(branchId, dateFrom, dateTo) {
    const q = `
      SELECT sales_return_id, return_number, raw_data->>'optLock' AS opt_lock, updated_at
      FROM sales_returns
      WHERE branch_id = $1
        AND trans_date >= $2
        AND trans_date <= $3
      ORDER BY trans_date DESC;
    `;
    const res = await db.query(q, [branchId, dateFrom, dateTo]);
    return res.rows;
  },

  // List returns with filters
  async list(filters = {}) {
    let q = `SELECT 
        sr.id, sr.sales_return_id, sr.return_number,
        sr.branch_id, sr.branch_name,
        sr.trans_date, sr.delivery_date,
        sr.customer_id, sr.customer_name,
        sr.salesman_id, sr.salesman_name,
        sr.subtotal, sr.discount, sr.tax, sr.total,
        sr.order_status,
        sr.created_at, sr.updated_at
      FROM sales_returns sr
      WHERE 1=1`;
    const params = [];
    let i = 1;

    if (filters.branch_id) {
      q += ` AND branch_id = $${i++}`;
      params.push(filters.branch_id);
    }
    if (filters.date_from) {
      q += ` AND trans_date >= $${i++}`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      q += ` AND trans_date <= $${i++}`;
      params.push(filters.date_to);
    }
    if (filters.customer_id) {
      q += ` AND customer_id = $${i++}`;
      params.push(filters.customer_id);
    }

    q += ' ORDER BY trans_date DESC, id DESC';

    if (filters.limit) {
      q += ` LIMIT $${i++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      q += ` OFFSET $${i++}`;
      params.push(filters.offset);
    }

    const res = await db.query(q, params);
    return res.rows;
  },

  // Get by internal ID with items
  async getById(id) {
    const headerQuery = `SELECT * FROM sales_returns WHERE id = $1`;
    const itemsQuery = `SELECT * FROM sales_return_items WHERE sales_return_id = (SELECT sales_return_id FROM sales_returns WHERE id = $1) ORDER BY id`;

    const headerRes = await db.query(headerQuery, [id]);
    const itemsRes = await db.query(itemsQuery, [id]);

    if (headerRes.rows.length === 0) return null;

    return {
      ...headerRes.rows[0],
      items: itemsRes.rows
    };
  },

  // Summary statistics
  async getSummary(filters = {}) {
    let q = `SELECT 
        COUNT(*) as total_returns,
        SUM(return_amount) as total_amount,
        AVG(return_amount) as avg_amount,
        MIN(trans_date) as earliest_date,
        MAX(trans_date) as latest_date
      FROM sales_returns WHERE 1=1`;
    const params = [];
    let i = 1;

    if (filters.branch_id) {
      q += ` AND branch_id = $${i++}`;
      params.push(filters.branch_id);
    }
    if (filters.date_from) {
      q += ` AND trans_date >= $${i++}`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      q += ` AND trans_date <= $${i++}`;
      params.push(filters.date_to);
    }

    const res = await db.query(q, params);
    return res.rows[0];
  }
};

module.exports = salesReturnModel;
