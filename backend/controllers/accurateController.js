const accurateService = require('../services/accurateService');
const cacheModel = require('../models/cacheModel');

const accurateController = {
  // Get all branches
  async getBranches(request, reply) {
    try {
      const { reload } = request.query;
      const branches = reload === 'true' 
        ? accurateService.reloadBranches() 
        : accurateService.getBranches();
      return { success: true, data: branches, count: branches.length };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  },

  // Reload branches config
  async reloadBranches(request, reply) {
    try {
      const branches = accurateService.reloadBranches();
      return { 
        success: true, 
        message: `Reloaded ${branches.length} branches`,
        data: branches 
      };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  },

  // Get list databases (cabang)
  async getDatabases(request, reply) {
    try {
      const { branchId } = request.query;
      const databases = await accurateService.getDatabases(branchId);
      return { success: true, data: databases };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  },

  // Get data dari Accurate API
  async getData(request, reply) {
    try {
      const { endpoint } = request.params;
      const { dbId, branchId } = request.query;

      if (!dbId) {
        reply.code(400);
        return { success: false, error: 'Database ID (dbId) required' };
      }

      const data = await accurateService.fetchData(endpoint, dbId, branchId);
      
      // Cache data ke SQLite
      await cacheModel.saveCache(endpoint, dbId, data);

      return { success: true, data };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  },

  // Get cached data dari SQLite
  async getCachedData(request, reply) {
    try {
      const { endpoint } = request.params;
      const { dbId } = request.query;

      const cached = await cacheModel.getCache(endpoint, dbId);
      
      if (!cached) {
        reply.code(404);
        return { success: false, error: 'No cached data found' };
      }

      return { success: true, data: cached };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  },

  // Get list with details
  async getListWithDetails(request, reply) {
    try {
      const { endpoint } = request.params;
      const { dbId, maxItems, dateFrom, dateTo, branchId } = request.query;

      if (!dbId) {
        reply.code(400);
        return { success: false, error: 'Database ID (dbId) required' };
      }

      const options = {
        maxItems: maxItems ? parseInt(maxItems) : 20,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      };

      const data = await accurateService.fetchListWithDetails(endpoint, dbId, options, branchId);
      
      // Cache hasil ke SQLite
      await cacheModel.saveCache(`${endpoint}-details`, dbId, data);

      return { success: true, data };
    } catch (error) {
      reply.code(500);
      return { success: false, error: error.message };
    }
  }
};

module.exports = accurateController;
