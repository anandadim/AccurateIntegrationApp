const db = require('../config/database');

const customerModel = {
  // Insert or update customer record
  async create(customerData) {
    const query = `
      INSERT INTO customers (
        customer_id, customer_no, name, discount_cat_id, category_name, salesman_id, salesman_name, phone, branch_id, raw_data, created_date, updated_date, suspended
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (customer_id, branch_id)
      DO UPDATE SET
        customer_no = EXCLUDED.customer_no,
        name = EXCLUDED.name,
        discount_cat_id = EXCLUDED.discount_cat_id,
        category_name = EXCLUDED.category_name,
        salesman_id = EXCLUDED.salesman_id,
        salesman_name = EXCLUDED.salesman_name,
        phone = EXCLUDED.phone,
        raw_data = EXCLUDED.raw_data,
        created_date = EXCLUDED.created_date,
        updated_date = EXCLUDED.updated_date,
        suspended = EXCLUDED.suspended,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`;

    const values = [
      customerData.customer_id,
      customerData.customer_no,
      customerData.name,
      customerData.discount_cat_id,
      customerData.category_name,
      customerData.salesman_id,
      customerData.salesman_name,
      customerData.phone,
      customerData.branch_id,
      JSON.stringify(customerData.raw_data || {}),
      customerData.created_date || null,
      customerData.updated_date || null,
      customerData.suspended || false
    ];

    const result = await db.query(query, values);
    return result.rows[0].id;
  },

  async getExistingForSync(branchId) {
    const result = await db.query(
      `SELECT customer_id, updated_at FROM customers WHERE branch_id = $1`,
      [branchId]
    );
    return result.rows;
  },

  async list(filters = {}) {
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    let i = 1;

    if (filters.branch_id) {
      query += ` AND branch_id = $${i}`;
      params.push(filters.branch_id);
      i++;
    }

    if (filters.limit) {
      query += ` LIMIT $${i}`;
      params.push(filters.limit);
      i++;
    }
    if (filters.offset) {
      query += ` OFFSET $${i}`;
      params.push(filters.offset);
      i++;
    }

    const result = await db.query(query, params);
    return result.rows;
  },

  async getById(id) {
    const result = await db.query('SELECT * FROM customers WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
};

module.exports = customerModel;
