const db = require('../config/database');

const purchaseInvoiceModel = {
  // Create invoice with items (transaction)
  async create(invoiceData, items) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      // Insert header
      const headerQuery = `
        INSERT INTO purchase_invoices (
          invoice_id, invoice_number, branch_id, branch_name,
          trans_date, created_date, vendor_no, vendor_name,
          bill_number, age, warehouse_id, warehouse_name,
          subtotal, discount, tax, total, 
          status_name, created_by, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (invoice_id) 
        DO UPDATE SET
          invoice_number = EXCLUDED.invoice_number,
          trans_date = EXCLUDED.trans_date,
          created_date = EXCLUDED.created_date,
          vendor_name = EXCLUDED.vendor_name,
          bill_number = EXCLUDED.bill_number,
          age = EXCLUDED.age,
          total = EXCLUDED.total,
          status_name = EXCLUDED.status_name,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const headerValues = [
        invoiceData.invoice_id,
        invoiceData.invoice_number,
        invoiceData.branch_id,
        invoiceData.branch_name,
        invoiceData.trans_date,
        invoiceData.created_date,
        invoiceData.vendor_no || null,
        invoiceData.vendor_name || null,
        invoiceData.bill_number || null,
        invoiceData.age || null,
        invoiceData.warehouse_id || null,
        invoiceData.warehouse_name || null,
        invoiceData.subtotal || 0,
        invoiceData.discount || 0,
        invoiceData.tax || 0,
        invoiceData.total,
        invoiceData.status_name || null,
        invoiceData.created_by || null,
        JSON.stringify(invoiceData.raw_data || {})
      ];

      const headerResult = await client.query(headerQuery, headerValues);
      const invoiceDbId = headerResult.rows[0].id;

      // Delete existing items (for update case)
      await client.query(
        'DELETE FROM purchase_invoice_items WHERE invoice_id = $1',
        [invoiceData.invoice_id] // Use invoice_id from Accurate
      );

      // Insert items
      if (items && items.length > 0) {
        const itemQuery = `
          INSERT INTO purchase_invoice_items (
            invoice_id, branch_id, item_no, item_name,
            quantity, unit_name, unit_price, discount, amount,
            warehouse_name, item_category
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        for (const item of items) {
          await client.query(itemQuery, [
            invoiceData.invoice_id, // Use invoice_id from Accurate, not database id
            invoiceData.branch_id,
            item.item_no,
            item.item_name,
            item.quantity,
            item.unit_name,
            item.unit_price,
            item.discount || 0,
            item.amount,
            item.warehouse_name || null,
            item.item_category || null
          ]);
        }
      }

      await client.query('COMMIT');
      return invoiceDbId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Get invoice by ID with items
  async getById(id) {
    const invoiceQuery = 'SELECT * FROM purchase_invoices WHERE id = $1';
    const itemsQuery = 'SELECT * FROM purchase_invoice_items WHERE invoice_id = $1 ORDER BY id';

    const invoiceResult = await db.query(invoiceQuery, [id]);
    const itemsResult = await db.query(itemsQuery, [id]);

    if (invoiceResult.rows.length === 0) {
      return null;
    }

    return {
      ...invoiceResult.rows[0],
      items: itemsResult.rows
    };
  },

  // Get existing invoices for sync check (lightweight)
  async getExistingForSync(branchId, dateFrom, dateTo) {
    const query = `
      SELECT 
        invoice_id,
        invoice_number,
        raw_data->>'optLock' as opt_lock,
        updated_at
      FROM purchase_invoices 
      WHERE branch_id = $1 
        AND trans_date BETWEEN $2 AND $3
      ORDER BY invoice_id
    `;
    
    const result = await db.query(query, [branchId, dateFrom, dateTo]);
    return result.rows;
  },

  // List invoices with filters
  async list(filters = {}) {
    let query = 'SELECT * FROM purchase_invoices WHERE 1=1';
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

    if (filters.vendor_no) {
      query += ` AND vendor_no = $${paramCount}`;
      params.push(filters.vendor_no);
      paramCount++;
    }

    // Sorting
    query += ' ORDER BY trans_date DESC, id DESC';

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
        branch_id,
        branch_name,
        COUNT(*) as invoice_count,
        SUM(total) as total_purchases,
        AVG(total) as avg_invoice,
        MIN(trans_date) as first_date,
        MAX(trans_date) as last_date
      FROM purchase_invoices
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

    query += ' GROUP BY branch_id, branch_name ORDER BY branch_id';

    const result = await db.query(query, params);
    return result.rows;
  },

  // Delete invoice
  async delete(id) {
    const query = 'DELETE FROM purchase_invoices WHERE id = $1 RETURNING id';
    const result = await db.query(query, [id]);
    return result.rows.length > 0;
  }
};

module.exports = purchaseInvoiceModel;
