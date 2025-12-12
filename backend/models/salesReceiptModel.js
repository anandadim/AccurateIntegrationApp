const db = require('../config/database');

const salesReceiptModel = {
  // Create receipt header + items in a transaction
  async create(receiptData, items) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert or update header row
      const headerQuery = `
        INSERT INTO sales_receipts (
          receipt_id, receipt_number, branch_id, branch_name,
          journal_id, trans_date, cheque_date,
          customer_id, customer_name,
          bank_id, bank_name,
          total_payment, over_pay, use_credit,
          payment_method, cheque_no, description,
          invoice_status, created_by, raw_data
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        ON CONFLICT (receipt_id)
        DO UPDATE SET
          receipt_number = EXCLUDED.receipt_number,
          journal_id = EXCLUDED.journal_id,
          trans_date = EXCLUDED.trans_date,
          cheque_date = EXCLUDED.cheque_date,
          customer_name = EXCLUDED.customer_name,
          bank_id = EXCLUDED.bank_id,
          bank_name = EXCLUDED.bank_name,
          total_payment = EXCLUDED.total_payment,
          over_pay = EXCLUDED.over_pay,
          use_credit = EXCLUDED.use_credit,
          payment_method = EXCLUDED.payment_method,
          cheque_no = EXCLUDED.cheque_no,
          description = EXCLUDED.description,
          invoice_status = EXCLUDED.invoice_status,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const headerValues = [
        receiptData.receipt_id,
        receiptData.receipt_number,
        receiptData.branch_id,
        receiptData.branch_name,
        receiptData.journal_id || null,
        receiptData.trans_date,
        receiptData.cheque_date,
        receiptData.customer_id || null,
        receiptData.customer_name || null,
        receiptData.bank_id || null,
        receiptData.bank_name || null,
        receiptData.total_payment || 0,
        receiptData.over_pay || 0,
        receiptData.use_credit || false,
        receiptData.payment_method || null,
        receiptData.cheque_no || null,
        receiptData.description || null,
        receiptData.invoice_status || null,
        receiptData.created_by || null,
        JSON.stringify(receiptData.raw_data || {})
      ];

      const headerResult = await client.query(headerQuery, headerValues);
      const dbHeaderId = headerResult.rows[0].id;

      // Delete previous items for this receipt (if any)
      //await client.query('DELETE FROM sales_receipt_items WHERE receipt_id = $1', [receiptData.receipt_id]);

      // Insert items
      if (items && items.length > 0) {
        const itemQuery = `
          INSERT INTO sales_receipt_items (
            receipt_id, branch_id,
            invoice_id, invoice_number, invoice_date, invoice_total, invoice_remaining,
            payment_amount, discount_amount, paid_amount, status
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
          )`;

        for (const item of items) {
          await client.query(itemQuery, [
            receiptData.receipt_id,
            receiptData.branch_id,
            item.invoice_id,
            item.invoice_number,
            item.invoice_date,
            item.invoice_total,
            item.invoice_remaining,
            item.payment_amount,
            item.discount_amount,
            item.paid_amount,
            item.status
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

  // Get receipt by ID with items
  async getById(id) {
    const receiptQuery = 'SELECT * FROM sales_receipts WHERE id = $1';
    const itemsQuery = 'SELECT * FROM sales_receipt_items WHERE receipt_id = (SELECT receipt_id FROM sales_receipts WHERE id = $1) ORDER BY id';

    const receiptResult = await db.query(receiptQuery, [id]);
    const itemsResult = await db.query(itemsQuery, [id]);

    if (receiptResult.rows.length === 0) return null;

    return {
      ...receiptResult.rows[0],
      items: itemsResult.rows
    };
  },

  // Lightweight existing list for sync check
  async getExistingForSync(branchId, dateFrom, dateTo) {
    const q = `
      SELECT 
        receipt_id,
        receipt_number,
        raw_data->>'optLock' AS opt_lock,
        updated_at
      FROM sales_receipts
      WHERE branch_id = $1 AND trans_date BETWEEN $2 AND $3
      ORDER BY receipt_id`;
    const res = await db.query(q, [branchId, dateFrom, dateTo]);
    return res.rows;
  },

  // List receipts with filters
  async list(filters = {}) {
    let q = 'SELECT * FROM sales_receipts WHERE 1=1';
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

  // Summary stats
  async getSummary(filters = {}) {
    let q = `
      SELECT
        branch_id, branch_name,
        COUNT(*) AS receipt_count,
        SUM(total_payment) AS total_received,
        AVG(total_payment) AS avg_receipt,
        MIN(trans_date) AS first_date,
        MAX(trans_date) AS last_date
      FROM sales_receipts WHERE 1=1`;
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

    q += ' GROUP BY branch_id, branch_name ORDER BY branch_id';

    const res = await db.query(q, params);
    return res.rows;
  }
};

module.exports = salesReceiptModel;
