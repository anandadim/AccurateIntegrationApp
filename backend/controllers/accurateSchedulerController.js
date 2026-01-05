const { getRecentLogs } = require('../models/accurateFetchLogRepository');
const {
  getSchedulerStatus,
  pauseAccurateScheduler,
  resumeAccurateScheduler,
  runAccurateSync,
} = require('../services/scheduler');

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

const accurateSchedulerController = {
  async getLogs(req, reply) {
    try {
      const { limit, status, branchId, dataType } = req.query || {};
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
        branchId: branchId ? String(branchId) : undefined,
        dataType: dataType ? String(dataType) : undefined,
      });

      handleSuccess(reply, logs);
    } catch (error) {
      handleError(reply, error, 'Failed to get Accurate scheduler logs');
    }
  },

  async getStatus(req, reply) {
    try {
      const status = getSchedulerStatus();
      handleSuccess(reply, status.accurate);
    } catch (error) {
      handleError(reply, error, 'Failed to get Accurate scheduler status');
    }
  },

  async pause(req, reply) {
    try {
      const status = pauseAccurateScheduler();
      handleSuccess(reply, status.accurate);
    } catch (error) {
      handleError(reply, error, 'Failed to pause Accurate scheduler');
    }
  },

  async resume(req, reply) {
    try {
      const status = resumeAccurateScheduler();
      handleSuccess(reply, status.accurate);
    } catch (error) {
      handleError(reply, error, 'Failed to resume Accurate scheduler');
    }
  },

  async runNow(req, reply) {
    try {
      await runAccurateSync();
      handleSuccess(reply, { message: 'Accurate scheduler run triggered manually' });
    } catch (error) {
      handleError(reply, error, 'Failed to run Accurate scheduler now');
    }
  },
};

module.exports = accurateSchedulerController;
