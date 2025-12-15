const db = require('../config/database');

const salesInvoiceRelationsModel = {
  /**
   * Upsert a relation row based on branch_id + sales_receipt composite key.
   * @param {Object} rel - relation data
   */
  async upsert(rel) {
    const query = `
      INSERT INTO sales_invoice_relations (
        branch_id, branch_name,
        order_number, order_id,
        invoice_number, invoice_id,
        trans_date,
        sales_receipt, receipt_date,
        payment_id, payment_name,
        created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, CURRENT_TIMESTAMP
      )
      ON CONFLICT (branch_id, sales_receipt)
      DO UPDATE SET
        branch_name     = EXCLUDED.branch_name,
        order_number    = EXCLUDED.order_number,
        order_id        = EXCLUDED.order_id,
        invoice_number  = EXCLUDED.invoice_number,
        invoice_id      = EXCLUDED.invoice_id,
        trans_date      = EXCLUDED.trans_date,
        receipt_date    = EXCLUDED.receipt_date,
        payment_id      = EXCLUDED.payment_id,
        payment_name    = EXCLUDED.payment_name,
        updated_at      = CURRENT_TIMESTAMP
      RETURNING id`;

    const values = [
      rel.branch_id,
      rel.branch_name || null,
      rel.order_number || null,
      rel.order_id || null,
      rel.invoice_number || null,
      rel.invoice_id || null,
      rel.trans_date || null,
      rel.sales_receipt,
      rel.receipt_date || null,
      rel.payment_id || null,
      rel.payment_name || null
    ];

    const res = await db.query(query, values);
    return res.rows[0].id;
  },

  /**
   * Bulk upsert relations.
   * @param {Array<Object>} relations 
   */
  async bulkUpsert(relations = []) {
    for (const rel of relations) {
      // eslint-disable-next-line no-await-in-loop
      await this.upsert(rel);
    }
  },

  async list(filters = {}) {
    let q = 'SELECT * FROM sales_invoice_relations WHERE 1=1';
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

    q += ' ORDER BY trans_date DESC, id DESC';

    const res = await db.query(q, params);
    return res.rows;
  },

  /**
   * Check status of relations (new/updated/unchanged)
   * @param {Array<Object>} incomingRelations - Relations to check
   * @param {String} branchId - Branch ID
   * @param {String} dateFrom - Date from
   * @param {String} dateTo - Date to
   */
  async checkStatus(incomingRelations = [], branchId, dateFrom, dateTo) {
    // Get existing relations from database
    const existingRelations = await this.list({
      branch_id: branchId,
      date_from: dateFrom,
      date_to: dateTo
    });

    const existingMap = new Map();
    existingRelations.forEach(rel => {
      const key = `${rel.branch_id}|${rel.sales_receipt}`;
      existingMap.set(key, rel);
    });

    const result = {
      new: [],
      updated: [],
      unchanged: [],
      summary: {
        new: 0,
        updated: 0,
        unchanged: 0,
        total: incomingRelations.length
      }
    };

    for (const incoming of incomingRelations) {
      const key = `${incoming.branch_id}|${incoming.sales_receipt}`;
      const existing = existingMap.get(key);

      if (!existing) {
        // New relation
        result.new.push(incoming);
        result.summary.new++;
      } else {
        // Check if updated
        const isUpdated = 
          existing.order_number !== incoming.order_number ||
          existing.invoice_number !== incoming.invoice_number ||
          existing.payment_id !== incoming.payment_id ||
          existing.payment_name !== incoming.payment_name;

        if (isUpdated) {
          result.updated.push({
            ...incoming,
            previous: existing
          });
          result.summary.updated++;
        } else {
          result.unchanged.push(incoming);
          result.summary.unchanged++;
        }
      }
    }

    return result;
  }
};

module.exports = salesInvoiceRelationsModel;
