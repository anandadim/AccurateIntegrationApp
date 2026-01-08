const db = require('../config/database');

const itemMutationsModel = {
  // Create item mutation (single table with all data in raw_data)
  async create(mutationData) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO item_mutations (
          mutation_id, mutation_number, branch_id, branch_name,
          trans_date, mutation_type, warehouse_id, warehouse_name,
          total_quantity, total_value, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (mutation_id, branch_id)
        DO UPDATE SET
          mutation_number = EXCLUDED.mutation_number,
          trans_date = EXCLUDED.trans_date,
          mutation_type = EXCLUDED.mutation_type,
          warehouse_name = EXCLUDED.warehouse_name,
          total_quantity = EXCLUDED.total_quantity,
          total_value = EXCLUDED.total_value,
          raw_data = EXCLUDED.raw_data,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;

      const values = [
        mutationData.mutation_id,
        mutationData.mutation_number,
        mutationData.branch_id,
        mutationData.branch_name,
        mutationData.trans_date,
        mutationData.mutation_type,
        mutationData.warehouse_id,
        mutationData.warehouse_name,
        mutationData.total_quantity || 0,
        mutationData.total_value || 0,
        JSON.stringify(mutationData.raw_data || {})
      ];

      const result = await client.query(query, values);
      await client.query('COMMIT');
      return result.rows[0].id;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Get mutation by ID
  async getById(id) {
    const query = 'SELECT * FROM item_mutations WHERE id = $1';
    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  },

  // Get existing mutations for sync check (lightweight)
  async getExistingForSync(branchId, dateFrom = null, dateTo = null) {
    let query = `
      SELECT
        mutation_id,
        mutation_number,
        raw_data->>'optLock' as opt_lock,
        updated_at
      FROM item_mutations
      WHERE branch_id = $1
    `;
    
    const params = [branchId];
    let paramIndex = 2;

    if (dateFrom && dateTo) {
      query += ` AND trans_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(dateFrom, dateTo);
      paramIndex += 2;
    } else if (dateFrom) {
      query += ` AND trans_date >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex += 1;
    } else if (dateTo) {
      query += ` AND trans_date <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex += 1;
    }

    query += ` ORDER BY mutation_id`;

    const result = await db.query(query, params);
    return result.rows;
  },

  // List mutations with filters
  async list(filters = {}) {
    let query = 'SELECT * FROM item_mutations WHERE 1=1';
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

    if (filters.mutation_type) {
      query += ` AND mutation_type = $${paramCount}`;
      params.push(filters.mutation_type);
      paramCount++;
    }

    if (filters.warehouse_id) {
      query += ` AND warehouse_id = $${paramCount}`;
      params.push(filters.warehouse_id);
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
        mutation_type,
        COUNT(*) as mutation_count,
        SUM(total_quantity) as total_quantity,
        SUM(total_value) as total_value,
        MIN(trans_date) as first_date,
        MAX(trans_date) as last_date
      FROM item_mutations
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

    query += ' GROUP BY branch_id, branch_name, mutation_type ORDER BY branch_id, mutation_type';

    const result = await db.query(query, params);
    return result.rows;
  },

  // Delete mutation
  async delete(id) {
    const query = 'DELETE FROM item_mutations WHERE id = $1 RETURNING id';
    const result = await db.query(query, [id]);
    return result.rows.length > 0;
  }
};

module.exports = itemMutationsModel;
