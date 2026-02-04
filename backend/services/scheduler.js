const cron = require('node-cron');
const srpService = require('./srpService');
const accurateService = require('./accurateService');
const db = require('../config/database');
const salesInvoiceController = require('../controllers/salesInvoiceController');
const salesOrderController = require('../controllers/salesOrderController');
const salesReceiptController = require('../controllers/salesReceiptController');
const {
  startLog,
  markSuccess,
  markFailure,
  markStaleRunningLogs,
} = require('../models/srpFetchLogRepository');
const {
  startLog: startAccurateLog,
  markSuccess: markAccurateSuccess,
  markFailure: markAccurateFailure,
  markStaleRunningLogs: markAccurateStaleRunningLogs,
} = require('../models/accurateFetchLogRepository');

const ENABLE_INVENTORY = process.env.SRP_SCHEDULER_ENABLE_INVENTORY !== 'false';
const ENABLE_SALES_DETAIL = process.env.SRP_SCHEDULER_ENABLE_SALES_DETAIL !== 'false';
const SALES_DETAIL_DELAY_MS = Number(process.env.SRP_SCHEDULER_SALES_DELAY_MS || 0);
const JOB_TIMEOUT_MS = Number(process.env.SRP_SCHEDULER_JOB_TIMEOUT_MS || 5 * 60 * 1000);
const STALE_MINUTES = Number(process.env.SRP_SCHEDULER_STALE_MINUTES || 90);

const ENABLE_ACCURATE = process.env.ACCURATE_SCHEDULER_ENABLE !== 'false';
const ENABLE_SALES_INVOICE = process.env.ACCURATE_SCHEDULER_ENABLE_SALES_INVOICE !== 'false';
const ENABLE_SALES_RECEIPT = process.env.ACCURATE_SCHEDULER_ENABLE_SALES_RECEIPT !== 'false';
const ENABLE_SALES_ORDER = process.env.ACCURATE_SCHEDULER_ENABLE_SALES_ORDER !== 'false';
const ACCURATE_BATCH_SIZE = Number(process.env.ACCURATE_SCHEDULER_BATCH_SIZE || 10);
const ACCURATE_BATCH_DELAY = Number(process.env.ACCURATE_SCHEDULER_BATCH_DELAY || 100);

let srpCronExpression = process.env.SRP_SCHEDULER_CRON || '*/20 * * * *';
let accurateCronExpression = process.env.ACCURATE_SCHEDULER_CRON || '0 22 * * *';

let isRunningSRP = false;
let isRunningAccurate = false;
let isPausedSRP = process.env.SRP_SCHEDULER_DEFAULT_PAUSED === 'true';
let isPausedAccurate = process.env.ACCURATE_SCHEDULER_DEFAULT_PAUSED === 'true';
let srpCronTask = null;
let accurateCronTask = null;

// Load scheduler config from database
const loadSchedulerConfig = async () => {
  try {
    const result = await db.query(
      'SELECT scheduler_name, cron_expression, is_paused FROM scheduler_config'
    );

    for (const row of result.rows) {
      if (row.scheduler_name === 'srp') {
        srpCronExpression = row.cron_expression;
        isPausedSRP = row.is_paused;
      } else if (row.scheduler_name === 'accurate') {
        accurateCronExpression = row.cron_expression;
        isPausedAccurate = row.is_paused;
      }
    }
    console.log('✅ Scheduler config loaded from database');
  } catch (error) {
    console.warn('⚠️ Failed to load scheduler config from database, using defaults:', error.message);
  }
};

// Update scheduler config in database
const updateSchedulerConfig = async (schedulerName, cronExpression, isPaused) => {
  try {
    const result = await db.query(
      `UPDATE scheduler_config 
       SET cron_expression = COALESCE($1, cron_expression), 
           is_paused = COALESCE($2, is_paused), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE scheduler_name = $3 
       RETURNING *`,
      [cronExpression, isPaused, schedulerName]
    );

    if (result.rows.length === 0) {
      throw new Error(`Scheduler '${schedulerName}' not found`);
    }

    return result.rows[0];
  } catch (error) {
    console.error('❌ Failed to update scheduler config:', error);
    throw error;
  }
};

// Get all scheduler configs
const getAllSchedulerConfigs = async () => {
  try {
    const result = await db.query(
      'SELECT * FROM scheduler_config ORDER BY scheduler_name'
    );
    return result.rows;
  } catch (error) {
    console.error('❌ Failed to get scheduler configs:', error);
    throw error;
  }
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const withTimeout = async (promise, timeoutMs, label) => {
  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`));
      }, timeoutMs);
    });

    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
};

const runInventoryJob = async ({ branch, targetDate }) => {
  if (!ENABLE_INVENTORY) {
    return;
  }

  const logId = await startLog({
    branchId: branch.id,
    storeCode: branch.storeCode,
    dataType: 'inventory',
    targetDate,
    metadata: {
      locationCode: branch.locationCode,
    },
  });

  try {
    console.log(`🔁 [Inventory] Branch ${branch.id} (${branch.name}) - start`);

    const result = await withTimeout(
      srpService.syncInventory({
        branchId: branch.id,
        endpoint: 'by-storage-location',
      }),
      JOB_TIMEOUT_MS,
      `[Inventory] Branch ${branch.id}`
    );

    const fetched = result?.totals?.totalFetched ?? 0;

    await markSuccess(logId, fetched);
    console.log(`✅ [Inventory] Branch ${branch.id} - fetched ${fetched} rows`);
  } catch (error) {
    await markFailure(logId, error);
    console.error(`❌ [Inventory] Branch ${branch.id} failed:`, error.message);
  }
};

const runSalesDetailJob = async ({ branch, targetDate }) => {
  if (!ENABLE_SALES_DETAIL) {
    return;
  }

  const storeCode = branch.storeCode;

  if (!storeCode) {
    console.warn(`⚠️ [SalesDetail] Branch ${branch.id} has no storeCode, skipping`);
    return;
  }

  const logId = await startLog({
    branchId: branch.id,
    storeCode,
    dataType: 'salesDetail',
    targetDate,
  });

  try {
    console.log(`🔁 [SalesDetail] Branch ${branch.id} (${branch.name}) - start`);

    const result = await withTimeout(
      srpService.syncSalesDetail({
        branchId: branch.id,
        storeCode,
        dateFrom: targetDate,
        dateTo: targetDate,
        chunkSizeDays: 1,
        delayMs: SALES_DETAIL_DELAY_MS,
        truncateBeforeInsert: false,
      }),
      JOB_TIMEOUT_MS,
      `[SalesDetail] Branch ${branch.id}`
    );

    const fetched = result?.totals?.totalFetched ?? 0;
    await markSuccess(logId, fetched);
    console.log(`✅ [SalesDetail] Branch ${branch.id} - fetched ${fetched} rows`);
  } catch (error) {
    await markFailure(logId, error);
    console.error(`❌ [SalesDetail] Branch ${branch.id} failed:`, error.message);
  }
};

// Accurate Scheduler Jobs
const runSalesInvoiceJob = async ({ branch, targetDate }) => {
  if (!ENABLE_ACCURATE || !ENABLE_SALES_INVOICE) {
    return;
  }

  const logId = await startAccurateLog({
    branchId: branch.id,
    branchName: branch.name,
    dataType: 'sales-invoice',
    targetDate,
    metadata: {
      dbId: branch.dbId,
      dateFilterType: 'transDate',
      batchSize: ACCURATE_BATCH_SIZE,
      batchDelay: ACCURATE_BATCH_DELAY
    },
  });

  try {
    console.log(`🔁 [SalesInvoice] Branch ${branch.id} (${branch.name}) - start`);

    const result = await withTimeout(
      accurateService.fetchAndStreamInsert(
        'sales-invoice',
        branch.dbId,
        {
          dateFrom: targetDate,
          dateTo: targetDate,
          dateFilterType: 'transDate',
          batchSize: ACCURATE_BATCH_SIZE,
          batchDelay: ACCURATE_BATCH_DELAY
        },
        branch.id,
        branch.name,
        // Callback for each batch
        async (batchDetails) => {
          return await salesInvoiceController._saveBatch(batchDetails, branch.id, branch.name);
        }
      ),
      JOB_TIMEOUT_MS,
      `[SalesInvoice] Branch ${branch.id}`
    );

    const fetched = result?.totalFetched ?? 0;
    await markAccurateSuccess(logId, fetched);
    console.log(`✅ [SalesInvoice] Branch ${branch.id} - fetched ${fetched} rows`);
  } catch (error) {
    await markAccurateFailure(logId, error);
    console.error(`❌ [SalesInvoice] Branch ${branch.id} failed:`, error.message);
  }
};

const runSalesReceiptJob = async ({ branch, targetDate }) => {
  if (!ENABLE_ACCURATE || !ENABLE_SALES_RECEIPT) {
    return;
  }

  const logId = await startAccurateLog({
    branchId: branch.id,
    branchName: branch.name,
    dataType: 'sales-receipt',
    targetDate,
    metadata: {
      dbId: branch.dbId,
      dateFilterType: 'transDate',
      batchSize: ACCURATE_BATCH_SIZE,
      batchDelay: ACCURATE_BATCH_DELAY
    },
  });

  try {
    console.log(`🔁 [SalesReceipt] Branch ${branch.id} (${branch.name}) - start`);

    const result = await withTimeout(
      accurateService.fetchAndStreamInsert(
        'sales-receipt',
        branch.dbId,
        {
          dateFrom: targetDate,
          dateTo: targetDate,
          dateFilterType: 'transDate',
          batchSize: ACCURATE_BATCH_SIZE,
          batchDelay: ACCURATE_BATCH_DELAY
        },
        branch.id,
        branch.name,
        // Callback for each batch
        async (batchDetails) => {
          return await salesReceiptController._saveBatch(batchDetails, branch.id, branch.name);
        }
      ),
      JOB_TIMEOUT_MS,
      `[SalesReceipt] Branch ${branch.id}`
    );

    const fetched = result?.totalFetched ?? 0;
    await markAccurateSuccess(logId, fetched);
    console.log(`✅ [SalesReceipt] Branch ${branch.id} - fetched ${fetched} rows`);
  } catch (error) {
    await markAccurateFailure(logId, error);
    console.error(`❌ [SalesReceipt] Branch ${branch.id} failed:`, error.message);
  }
};

const runSalesOrderJob = async ({ branch, targetDate }) => {
  if (!ENABLE_ACCURATE || !ENABLE_SALES_ORDER) {
    return;
  }

  const logId = await startAccurateLog({
    branchId: branch.id,
    branchName: branch.name,
    dataType: 'sales-order',
    targetDate,
    metadata: {
      dbId: branch.dbId,
      dateFilterType: 'transDate',
      batchSize: ACCURATE_BATCH_SIZE,
      batchDelay: ACCURATE_BATCH_DELAY
    },
  });

  try {
    console.log(`🔁 [SalesOrder] Branch ${branch.id} (${branch.name}) - start`);

    const result = await withTimeout(
      accurateService.fetchAndStreamInsert(
        'sales-order',
        branch.dbId,
        {
          dateFrom: targetDate,
          dateTo: targetDate,
          dateFilterType: 'transDate',
          batchSize: ACCURATE_BATCH_SIZE,
          batchDelay: ACCURATE_BATCH_DELAY
        },
        branch.id,
        branch.name,
        // Callback for each batch
        async (batchDetails) => {
          return await salesOrderController._saveBatch(batchDetails, branch.id, branch.name);
        }
      ),
      JOB_TIMEOUT_MS,
      `[SalesOrder] Branch ${branch.id}`
    );

    const fetched = result?.totalFetched ?? 0;
    await markAccurateSuccess(logId, fetched);
    console.log(`✅ [SalesOrder] Branch ${branch.id} - fetched ${fetched} rows`);
  } catch (error) {
    await markAccurateFailure(logId, error);
    console.error(`❌ [SalesOrder] Branch ${branch.id} failed:`, error.message);
  }
};

const runSRPSync = async () => {
  if (isPausedSRP) {
    console.warn('⚠️ SRP Scheduler run skipped because scheduler is paused');
    return;
  }

  if (isRunningSRP) {
    console.warn('⚠️ SRP Scheduler run skipped because previous job is still running');
    return;
  }

  const targetDate = formatDate(new Date());

  try {
    isRunningSRP = true;
    console.log(`🚀 SRP Scheduler run started for ${targetDate}`);

    // Mark stale SRP logs
    const srpMarked = await markStaleRunningLogs({ olderThanMinutes: STALE_MINUTES });
    if (srpMarked > 0) {
      console.warn(`⚠️ Marked ${srpMarked} stale SRP logs as timeout`);
    }

    // SRP Branches
    const srpBranches = srpService.getBranches();
    if (srpBranches.length) {
      console.log(`📋 Processing ${srpBranches.length} SRP branches`);
      for (const branch of srpBranches) {
        await runInventoryJob({ branch, targetDate });
        await runSalesDetailJob({ branch, targetDate });
      }
    } else {
      console.warn('⚠️ No SRP branches configured, skipping SRP scheduler run');
    }

    console.log(`✅ SRP Scheduler run completed for ${targetDate}`);
  } catch (error) {
    console.error('❌ SRP Scheduler run failed:', error);
  } finally {
    isRunningSRP = false;
  }
};

const runAccurateSync = async () => {
  if (!ENABLE_ACCURATE) {
    console.log('⚠️ Accurate scheduler is disabled');
    return;
  }

  if (isPausedAccurate) {
    console.warn('⚠️ Accurate Scheduler run skipped because scheduler is paused');
    return;
  }

  if (isRunningAccurate) {
    console.warn('⚠️ Accurate Scheduler run skipped because previous job is still running');
    return;
  }

  const targetDate = formatDate(new Date());

  try {
    isRunningAccurate = true;
    console.log(`🚀 Accurate Scheduler run started for ${targetDate}`);

    // Mark stale Accurate logs
    const accurateMarked = await markAccurateStaleRunningLogs({ olderThanMinutes: STALE_MINUTES });
    if (accurateMarked > 0) {
      console.warn(`⚠️ Marked ${accurateMarked} stale Accurate logs as timeout`);
    }

    // Accurate Branches
    const accurateBranches = accurateService.getBranches();
    if (accurateBranches.length) {
      console.log(`📋 Processing ${accurateBranches.length} Accurate branches`);
      for (const branch of accurateBranches) {
        await runSalesInvoiceJob({ branch, targetDate });
        await runSalesReceiptJob({ branch, targetDate });
        await runSalesOrderJob({ branch, targetDate });
      }
    } else {
      console.warn('⚠️ No Accurate branches configured, skipping Accurate scheduler run');
    }

    console.log(`✅ Accurate Scheduler run completed for ${targetDate}`);
  } catch (error) {
    console.error('❌ Accurate Scheduler run failed:', error);
  } finally {
    isRunningAccurate = false;
  }
};

const runScheduledSync = async () => {
  await runSRPSync();
  await runAccurateSync();
};

// Initialize scheduler
async function initScheduler() {
  // Load config from database first
  await loadSchedulerConfig();

  if (srpCronTask) {
    srpCronTask.stop();
  }
  if (accurateCronTask) {
    accurateCronTask.stop();
  }

  // SRP Scheduler
  srpCronTask = cron.schedule(srpCronExpression, async () => {
    console.log('⏰ SRP Scheduler tick at', new Date().toISOString());
    await runSRPSync();
  });

  // Accurate Scheduler
  accurateCronTask = cron.schedule(accurateCronExpression, async () => {
    console.log('⏰ Accurate Scheduler tick at', new Date().toISOString());
    await runAccurateSync();
  });

  // Only start the cron tasks if not paused
  if (isPausedSRP && srpCronTask) {
    srpCronTask.stop();
    console.log('⏸️ SRP Scheduler initialized in paused state');
  } else if (!isPausedSRP && srpCronTask) {
    console.log('▶️ SRP Scheduler initialized and started automatically');
  }

  if (isPausedAccurate && accurateCronTask) {
    accurateCronTask.stop();
    console.log('⏸️ Accurate Scheduler initialized in paused state');
  } else if (!isPausedAccurate && accurateCronTask) {
    console.log('▶️ Accurate Scheduler initialized and started automatically');
  }

  console.log(`📅 SRP Scheduler initialized - running on cron "${srpCronExpression}"`);
  console.log(`📅 Accurate Scheduler initialized - running on cron "${accurateCronExpression}"`);
  console.log(`🔧 SRP Settings: ENABLE_INVENTORY=${ENABLE_INVENTORY}, ENABLE_SALES_DETAIL=${ENABLE_SALES_DETAIL}`);
  console.log(`🔧 Accurate Settings: ENABLE_ACCURATE=${ENABLE_ACCURATE}, ENABLE_SALES_INVOICE=${ENABLE_SALES_INVOICE}, ENABLE_SALES_RECEIPT=${ENABLE_SALES_RECEIPT}, ENABLE_SALES_ORDER=${ENABLE_SALES_ORDER}`);
  console.log(`🔧 Batch Settings: SIZE=${ACCURATE_BATCH_SIZE}, DELAY=${ACCURATE_BATCH_DELAY}ms`);
}

const pauseScheduler = () => {
  isPausedSRP = true;
  isPausedAccurate = true;
  if (srpCronTask) {
    srpCronTask.stop();
  }
  if (accurateCronTask) {
    accurateCronTask.stop();
  }
  console.log('⏸️ All schedulers paused');
  return getSchedulerStatus();
};

const pauseSRPScheduler = () => {
  isPausedSRP = true;
  if (srpCronTask) {
    srpCronTask.stop();
  }
  console.log('⏸️ SRP Scheduler paused');
  return getSchedulerStatus();
};

const pauseAccurateScheduler = () => {
  isPausedAccurate = true;
  if (accurateCronTask) {
    accurateCronTask.stop();
  }
  console.log('⏸️ Accurate Scheduler paused');
  return getSchedulerStatus();
};

const resumeScheduler = () => {
  isPausedSRP = false;
  isPausedAccurate = false;
  if (srpCronTask) {
    srpCronTask.start();
  }
  if (accurateCronTask) {
    accurateCronTask.start();
  }
  console.log('▶️ All schedulers resumed');
  return getSchedulerStatus();
};

const resumeSRPScheduler = () => {
  isPausedSRP = false;
  if (srpCronTask) {
    srpCronTask.start();
  }
  console.log('▶️ SRP Scheduler resumed');
  return getSchedulerStatus();
};

const resumeAccurateScheduler = () => {
  isPausedAccurate = false;
  if (accurateCronTask) {
    accurateCronTask.start();
  }
  console.log('▶️ Accurate Scheduler resumed');
  return getSchedulerStatus();
};

const getSchedulerStatus = () => ({
  srp: {
    cron: srpCronExpression,
    running: isRunningSRP,
    paused: isPausedSRP,
  },
  accurate: {
    cron: accurateCronExpression,
    running: isRunningAccurate,
    paused: isPausedAccurate,
  },
});

// Update scheduler cron expression and restart
const updateSchedulerCron = async (schedulerName, cronExpression) => {
  try {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error('Invalid cron expression');
    }

    // Update in database
    const config = await updateSchedulerConfig(schedulerName, cronExpression, null);

    // Update local variable
    if (schedulerName === 'srp') {
      srpCronExpression = cronExpression;
      // Restart SRP scheduler
      if (srpCronTask) {
        srpCronTask.stop();
      }
      srpCronTask = cron.schedule(srpCronExpression, async () => {
        console.log('⏰ SRP Scheduler tick at', new Date().toISOString());
        await runSRPSync();
      });
      // Restore pause state
      if (isPausedSRP) {
        srpCronTask.stop();
      }
      console.log(`✅ SRP Scheduler cron updated to: ${cronExpression}`);
    } else if (schedulerName === 'accurate') {
      accurateCronExpression = cronExpression;
      // Restart Accurate scheduler
      if (accurateCronTask) {
        accurateCronTask.stop();
      }
      accurateCronTask = cron.schedule(accurateCronExpression, async () => {
        console.log('⏰ Accurate Scheduler tick at', new Date().toISOString());
        await runAccurateSync();
      });
      // Restore pause state
      if (isPausedAccurate) {
        accurateCronTask.stop();
      }
      console.log(`✅ Accurate Scheduler cron updated to: ${cronExpression}`);
    }

    return config;
  } catch (error) {
    console.error(`❌ Failed to update ${schedulerName} scheduler cron:`, error);
    throw error;
  }
};

// Update scheduler status (pause/resume)
const updateSchedulerStatus = async (schedulerName, isPaused) => {
  try {
    // Update in database
    const config = await updateSchedulerConfig(schedulerName, null, isPaused);

    // Update local variable and control cron task
    if (schedulerName === 'srp') {
      isPausedSRP = isPaused;
      if (isPaused) {
        if (srpCronTask) srpCronTask.stop();
        console.log('⏸️ SRP Scheduler paused via API');
      } else {
        if (srpCronTask) srpCronTask.start();
        console.log('▶️ SRP Scheduler resumed via API');
      }
    } else if (schedulerName === 'accurate') {
      isPausedAccurate = isPaused;
      if (isPaused) {
        if (accurateCronTask) accurateCronTask.stop();
        console.log('⏸️ Accurate Scheduler paused via API');
      } else {
        if (accurateCronTask) accurateCronTask.start();
        console.log('▶️ Accurate Scheduler resumed via API');
      }
    }

    return config;
  } catch (error) {
    console.error(`❌ Failed to update ${schedulerName} scheduler status:`, error);
    throw error;
  }
};

module.exports = {
  initScheduler,
  runScheduledSync,
  runSRPSync,
  runAccurateSync,
  pauseScheduler,
  pauseSRPScheduler,
  pauseAccurateScheduler,
  resumeScheduler,
  resumeSRPScheduler,
  resumeAccurateScheduler,
  getSchedulerStatus,
  getAllSchedulerConfigs,
  updateSchedulerCron,
  updateSchedulerStatus,
};
