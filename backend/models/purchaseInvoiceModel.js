const { pool } = require('../config/database');

const purchaseInvoiceModel = {
  // Create or update purchase invoice with items
  async create(headerData, items = []) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Upsert header
      const headerQuery = `
        INSERT INTO purchase_invoices (
          invoice_id, invoice_number, branch_id, branch_name,
          trans_date, created_date,
          vendor_no, vendor_name,
          bill_number,
          subtotal, discount, tax, total,
          status_name,
          created_by, opt_lock, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (invoice_id, branch_id) 
        DO UPDATE SET
          invoice_id = EXCLUDED.invoice_id,
          trans_date = EXCLUDED.trans_date,
          created_date = EXCLUDED.created_date,
          vendor_no = EXCLUDED.vendor_no,
          vendor_name = EXCLUDED.vendor_name,
          bill_number = EXCLUDED.bill_number,
          subtotal = EXCLUDED.subtotal,
          discount = EXCLUDED.discount,
          tax = EXCLUDED.tax,
          total = EXCLUDED.total,
          status_name = EXCLUDED.status_name,
          created_by = EXCLUDED.created_by,
          opt_lock = EXCLUDED.opt_lock,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING invoice_id;
      `;

      const headerValues = [
        headerData.invoice_id,
        headerData.invoice_number,
        headerData.branch_id,
        headerData.branch_name,
        headerData.trans_date,
        headerData.created_date,
        headerData.vendor_no,
        headerData.vendor_name,
        headerData.bill_number,
        headerData.subtotal,
        headerData.discount,
        headerData.tax,
        headerData.total,
        headerData.status_name,
        headerData.created_by,
        headerData.opt_lock || 0,
        headerData.raw_data
      ];

      const headerResult = await client.query(headerQuery, headerValues);
      const invoiceId = headerResult.rows[0].invoice_id;

      // Upsert items (no delete - allows partial updates)
      if (items && items.length > 0) {
        const itemQuery = `
          INSERT INTO purchase_invoice_items (
            invoice_id, detail_id, branch_id, seq, invoice_number, item_no, item_name,
            quantity, unit_name, unit_price, discount, amount,
            warehouse_name, item_category
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (invoice_id, detail_id, branch_id,seq)
             DO UPDATE SET
              invoice_number = EXCLUDED.invoice_number,
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
          const itemValues = [
            invoiceId,
            item.detail_id,
            headerData.branch_id,
            item.seq,
            headerData.invoice_number,
            item.item_no,
            item.item_name,
            item.quantity,
            item.unit_name,
            item.unit_price,
            item.discount,
            item.amount,
            item.warehouse_name,
            item.item_category
          ];

          await client.query(itemQuery, itemValues);
        }
      }

      await client.query('COMMIT');
      return { success: true, invoiceId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Get existing invoices for sync comparison
  async getExistingForSync(branchId, dateFrom, dateTo) {
    const query = `
      SELECT 
        invoice_id,
        invoice_number,
        opt_lock,
        updated_at
      FROM purchase_invoices 
      WHERE branch_id = $1 
        AND trans_date BETWEEN $2 AND $3
      ORDER BY invoice_id
    `;
    
    const result = await pool.query(query, [branchId, dateFrom, dateTo]);
    return result.rows;
  },

  // List invoices with filters
  async list(filters = {}) {
    let query = 'SELECT * FROM purchase_invoices WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.branch_id) {
      query += ` AND branch_id = $${paramCount++}`;
      values.push(filters.branch_id);
    }

    if (filters.date_from) {
      query += ` AND trans_date >= $${paramCount++}`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ` AND trans_date <= $${paramCount++}`;
      values.push(filters.date_to);
    }

    if (filters.vendor_id) {
      query += ` AND vendor_id = $${paramCount++}`;
      values.push(filters.vendor_id);
    }

    if (filters.status_name) {
      query += ` AND status_name = $${paramCount++}`;
      values.push(filters.status_name);
    }

    query += ' ORDER BY trans_date DESC, invoice_number DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramCount++}`;
      values.push(filters.limit);
    }

    if (filters.offset) {
      query += ` OFFSET $${paramCount++}`;
      values.push(filters.offset);
    }

    const result = await pool.query(query, values);
    return result.rows;
  },

  // Get invoice by ID with items
  async getById(id) {
    const headerQuery = 'SELECT * FROM purchase_invoices WHERE id = $1';
    const headerResult = await pool.query(headerQuery, [id]);

    if (headerResult.rows.length === 0) {
      return null;
    }

    const invoice = headerResult.rows[0];
    const itemsQuery = 'SELECT * FROM purchase_invoice_items WHERE invoice_id = $1 ORDER BY id';
    const itemsResult = await pool.query(itemsQuery, [invoice.invoice_id]);

    return {
      ...invoice,
      items: itemsResult.rows
    };
  },

  // Get summary statistics
  async getSummary(filters = {}) {
    let query = `
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(DISTINCT vendor_id) as total_vendors,
        SUM(total_amount) as total_amount,
        AVG(total_amount) as avg_amount,
        MAX(trans_date) as latest_date
      FROM purchase_invoices
      WHERE 1=1
    `;
    const values = [];
    let paramCount = 1;

    if (filters.branch_id) {
      query += ` AND branch_id = $${paramCount++}`;
      values.push(filters.branch_id);
    }

    if (filters.date_from) {
      query += ` AND trans_date >= $${paramCount++}`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      query += ` AND trans_date <= $${paramCount++}`;
      values.push(filters.date_to);
    }

    const result = await pool.query(query, values);
    return result.rows[0];
  }
};

module.exports = purchaseInvoiceModel;
