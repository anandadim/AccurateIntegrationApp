const {
  getAllSchedulerConfigs,
  updateSchedulerCron,
  updateSchedulerStatus,
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

const schedulerConfigController = {
  async getAll(req, reply) {
    try {
      const configs = await getAllSchedulerConfigs();
      handleSuccess(reply, configs);
    } catch (error) {
      handleError(reply, error, 'Failed to get scheduler configs');
    }
  },

  async updateCron(req, reply) {
    try {
      const { schedulerName, cronExpression } = req.body;

      if (!schedulerName || !cronExpression) {
        return reply.status(400).send({
          success: false,
          message: 'schedulerName and cronExpression are required',
        });
      }

      if (!['srp', 'accurate'].includes(schedulerName)) {
        return reply.status(400).send({
          success: false,
          message: 'schedulerName must be either "srp" or "accurate"',
        });
      }

      const config = await updateSchedulerCron(schedulerName, cronExpression);
      handleSuccess(reply, config);
    } catch (error) {
      handleError(reply, error, 'Failed to update scheduler cron');
    }
  },

  async updateStatus(req, reply) {
    try {
      const { schedulerName, isPaused } = req.body;

      if (!schedulerName || isPaused === undefined) {
        return reply.status(400).send({
          success: false,
          message: 'schedulerName and isPaused are required',
        });
      }

      if (!['srp', 'accurate'].includes(schedulerName)) {
        return reply.status(400).send({
          success: false,
          message: 'schedulerName must be either "srp" or "accurate"',
        });
      }

      const config = await updateSchedulerStatus(schedulerName, isPaused);
      handleSuccess(reply, config);
    } catch (error) {
      handleError(reply, error, 'Failed to update scheduler status');
    }
  },
};

module.exports = schedulerConfigController;
