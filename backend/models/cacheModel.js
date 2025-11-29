const db = require('../config/database');

const cacheModel = {
  // Save data ke cache (PostgreSQL)
  async saveCache(endpoint, cabangId, data) {
    try {
      const dataJson = JSON.stringify(data);
      
      // Check if exists
      const checkQuery = `
        SELECT id FROM accurate_data 
        WHERE endpoint = $1 AND cabang_id = $2
      `;
      const checkResult = await db.query(checkQuery, [endpoint, cabangId]);
      
      if (checkResult.rows.length > 0) {
        // Update existing
        const updateQuery = `
          UPDATE accurate_data 
          SET data = $1, updated_at = CURRENT_TIMESTAMP 
          WHERE id = $2
          RETURNING id
        `;
        const result = await db.query(updateQuery, [dataJson, checkResult.rows[0].id]);
        return { id: result.rows[0].id, updated: true };
      } else {
        // Insert new
        const insertQuery = `
          INSERT INTO accurate_data (endpoint, cabang_id, data)
          VALUES ($1, $2, $3)
          RETURNING id
        `;
        const result = await db.query(insertQuery, [endpoint, cabangId, dataJson]);
        return { id: result.rows[0].id, updated: false };
      }
    } catch (error) {
      console.error('Error saving cache:', error);
      throw error;
    }
  },

  // Get cached data (PostgreSQL)
  async getCache(endpoint, cabangId) {
    try {
      const query = `
        SELECT * FROM accurate_data 
        WHERE endpoint = $1 AND cabang_id = $2 
        ORDER BY updated_at DESC 
        LIMIT 1
      `;
      
      const result = await db.query(query, [endpoint, cabangId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const row = result.rows[0];
      return {
        ...row,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      };
    } catch (error) {
      console.error('Error getting cache:', error);
      throw error;
    }
  },

  // Get all cached endpoints (PostgreSQL)
  async getAllCache() {
    try {
      const query = `
        SELECT endpoint, cabang_id, updated_at 
        FROM accurate_data 
        ORDER BY updated_at DESC
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting all cache:', error);
      throw error;
    }
  }
};

module.exports = cacheModel;
