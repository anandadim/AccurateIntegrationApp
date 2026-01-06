const srpService = require('../services/srpService');
const {
  getSchedulerStatus,
  pauseSRPScheduler,
  resumeSRPScheduler,
  runScheduledSync,
} = require('../services/scheduler');
const { getRecentLogs } = require('../models/srpFetchLogRepository');

const handleSuccess = (reply, data) => {
  reply.send({
    success: true,
    data,
  });
};

const handleError = (reply, error, fallbackMessage) => {
  console.error(fallbackMessage, error);
  const status = error.status || 500;
  reply.status(status).send({
    success: false,
    message: error.message || fallbackMessage,
    details: error.response || error.details || null,
  });
};

const srpController = {
  async getBranches(req, reply) {
    try {
      const branches = srpService.getBranches();
      handleSuccess(reply, branches);
    } catch (error) {
      handleError(reply, error, 'Failed to get SNJ branches');
    }
  },

  async getSchedulerStatus(req, reply) {
    try {
      const status = getSchedulerStatus();
      handleSuccess(reply, status.srp);
    } catch (error) {
      handleError(reply, error, 'Failed to get scheduler status');
    }
  },

  async pauseScheduler(req, reply) {
    try {
      const status = pauseSRPScheduler();
      handleSuccess(reply, status.srp);
    } catch (error) {
      handleError(reply, error, 'Failed to pause scheduler');
    }
  },

  async resumeScheduler(req, reply) {
    try {
      const status = resumeSRPScheduler();
      handleSuccess(reply, status.srp);
    } catch (error) {
      handleError(reply, error, 'Failed to resume scheduler');
    }
  },

  async runSchedulerNow(req, reply) {
    try {
      await runScheduledSync();
      handleSuccess(reply, { message: 'Scheduler run triggered manually' });
    } catch (error) {
      handleError(reply, error, 'Failed to run scheduler now');
    }
  },

  async getFetchLogs(req, reply) {
    try {
      const { limit, status } = req.query || {};
      let statuses = null;

      if (status) {
        if (Array.isArray(status)) {
          statuses = status.map((item) => String(item).trim()).filter(Boolean);
        } else {
          statuses = String(status)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }
      }

      const logs = await getRecentLogs({
        limit: limit ? Number(limit) : undefined,
        statuses: statuses && statuses.length ? statuses : null,
      });

      handleSuccess(reply, logs);
    } catch (error) {
      handleError(reply, error, 'Failed to get SRP scheduler logs');
    }
  },

  async reloadBranches(req, reply) {
    try {
      const branches = srpService.reloadBranches();
      handleSuccess(reply, branches);
    } catch (error) {
      handleError(reply, error, 'Failed to reload SNJ branches');
    }
  },

  async fetchInventoryByLocation(req, reply) {
    try {
      const {
        branchId = null,
        locationCode = null,
        articleCodes,
        page,
        perPage,
      } = req.query;

      const articleCodeArray = typeof articleCodes === 'string'
        ? articleCodes.split(',').map(code => code.trim()).filter(Boolean)
        : [];

      const result = await srpService.fetchInventoryByLocation({
        branchId,
        locationCode,
        articleCodes: articleCodeArray,
        page: page ? Number(page) : undefined,
        perPage: perPage ? Number(perPage) : undefined,
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to fetch SNJ inventory by location');
    }
  },

  async fetchInventoryByLocationAll(req, reply) {
    try {
      const {
        branchId = null,
        locationCode = null,
        articleCodes,
        perPage,
        maxPages,
        pageDelay,
      } = req.query;

      const articleCodeArray = typeof articleCodes === 'string'
        ? articleCodes.split(',').map(code => code.trim()).filter(Boolean)
        : [];

      const result = await srpService.fetchInventoryByLocationAllPages({
        branchId,
        locationCode,
        articleCodes: articleCodeArray,
        perPage: perPage ? Number(perPage) : undefined,
        maxPages: maxPages ? Number(maxPages) : null,
        pageDelay: pageDelay ? Number(pageDelay) : undefined,
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to fetch SNJ inventory by location (all pages)');
    }
  },

  async fetchInventoryByStorage(req, reply) {
    try {
      const {
        branchId = null,
        locationCode = null,
        articleCodes,
        page,
        perPage,
      } = req.query;

      const articleCodeArray = typeof articleCodes === 'string'
        ? articleCodes.split(',').map(code => code.trim()).filter(Boolean)
        : [];

      const result = await srpService.fetchInventoryByStorageLocation({
        branchId,
        locationCode,
        articleCodes: articleCodeArray,
        page: page ? Number(page) : undefined,
        perPage: perPage ? Number(perPage) : undefined,
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to fetch SNJ inventory by storage location');
    }
  },

  async fetchInventoryByStorageAll(req, reply) {
    try {
      const {
        branchId = null,
        locationCode = null,
        articleCodes,
        perPage,
        maxPages,
        pageDelay,
      } = req.query;

      const articleCodeArray = typeof articleCodes === 'string'
        ? articleCodes.split(',').map(code => code.trim()).filter(Boolean)
        : [];

      const result = await srpService.fetchInventoryByStorageLocationAllPages({
        branchId,
        locationCode,
        articleCodes: articleCodeArray,
        perPage: perPage ? Number(perPage) : undefined,
        maxPages: maxPages ? Number(maxPages) : null,
        pageDelay: pageDelay ? Number(pageDelay) : undefined,
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to fetch SNJ inventory by storage location (all pages)');
    }
  },

  async syncInventory(req, reply) {
    try {
      const payload = Object.assign({}, req.query || {}, req.body || {});

      const {
        branchId = null,
        locationCode = null,
        articleCodes,
        perPage,
        maxPages,
        pageDelay,
        truncateBeforeInsert,
        endpoint,
      } = payload;

      let articleCodeArray = [];
      if (Array.isArray(articleCodes)) {
        articleCodeArray = articleCodes.map(code => String(code).trim()).filter(Boolean);
      } else if (typeof articleCodes === 'string') {
        articleCodeArray = articleCodes.split(',').map(code => code.trim()).filter(Boolean);
      }

      const normalizeBoolean = (value, defaultValue = false) => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lowered = value.toLowerCase();
          if (['true', '1', 'yes', 'y'].includes(lowered)) return true;
          if (['false', '0', 'no', 'n'].includes(lowered)) return false;
        }
        return Boolean(value);
      };

      const result = await srpService.syncInventory({
        branchId,
        locationCode,
        articleCodes: articleCodeArray,
        perPage: perPage ? Number(perPage) : undefined,
        maxPages: maxPages ? Number(maxPages) : null,
        pageDelay: pageDelay ? Number(pageDelay) : undefined,
        truncateBeforeInsert: normalizeBoolean(truncateBeforeInsert, false),
        endpoint,
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to sync SNJ inventory');
    }
  },

  async syncItemMaster(req, reply) {
    try {
      const payload = Object.assign({}, req.query || {}, req.body || {});

      const {
        perPage,
        maxPages,
        pageDelay,
        truncateBeforeInsert,
      } = payload;

      const normalizeBoolean = (value, defaultValue = false) => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lowered = value.toLowerCase();
          if (['true', '1', 'yes', 'y'].includes(lowered)) return true;
          if (['false', '0', 'no', 'n'].includes(lowered)) return false;
        }
        return Boolean(value);
      };

      const result = await srpService.syncItemMaster({
        perPage: perPage ? Number(perPage) : undefined,
        maxPages: maxPages ? Number(maxPages) : null,
        pageDelay: pageDelay ? Number(pageDelay) : undefined,
        truncateBeforeInsert: normalizeBoolean(truncateBeforeInsert, false),
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to sync SNJ item master');
    }
  },

  async getItemMasterRecords(req, reply) {
    try {
      const {
        search = null,
        entityCode = null,
        articleCode = null,
        perPage,
        page,
      } = req.query || {};

      const result = await srpService.getItemMasterRecords({
        search: search || null,
        entityCode: entityCode || null,
        articleCode: articleCode || null,
        perPage: perPage ? Number(perPage) : undefined,
        page: page ? Number(page) : undefined,
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to get SNJ item master records');
    }
  },

  async fetchSalesDetail(req, reply) {
    try {
      const {
        branchId = null,
        storeCode,
        dateFrom,
        dateTo,
      } = req.query;

      const result = await srpService.fetchSalesDetail({
        branchId,
        storeCode,
        dateFrom,
        dateTo,
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to fetch SNJ sales detail');
    }
  },

  async syncSalesDetail(req, reply) {
    try {
      const payload = Object.assign({}, req.query || {}, req.body || {});

      const {
        branchId = null,
        storeCode,
        dateFrom,
        dateTo,
        chunkSizeDays,
        delayMs,
        truncateBeforeInsert,
      } = payload;

      const normalizeBoolean = (value, defaultValue = false) => {
        if (value === undefined || value === null) return defaultValue;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lowered = value.toLowerCase();
          if (['true', '1', 'yes', 'y'].includes(lowered)) return true;
          if (['false', '0', 'no', 'n'].includes(lowered)) return false;
        }
        return Boolean(value);
      };

      const result = await srpService.syncSalesDetail({
        branchId,
        storeCode,
        dateFrom,
        dateTo,
        chunkSizeDays: chunkSizeDays ? Number(chunkSizeDays) : undefined,
        delayMs: delayMs ? Number(delayMs) : undefined,
        truncateBeforeInsert: normalizeBoolean(truncateBeforeInsert, false),
      });

      handleSuccess(reply, result);
    } catch (error) {
      handleError(reply, error, 'Failed to sync SNJ sales detail');
    }
  },
};

module.exports = srpController;
