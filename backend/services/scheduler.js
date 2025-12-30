const cron = require('node-cron');
const srpService = require('./srpService');
const {
  startLog,
  markSuccess,
  markFailure,
  markStaleRunningLogs,
} = require('../models/srpFetchLogRepository');

const SCHEDULER_CRON = process.env.SRP_SCHEDULER_CRON || '*/10 * * * *';
const ENABLE_INVENTORY = process.env.SRP_SCHEDULER_ENABLE_INVENTORY !== 'false';
const ENABLE_SALES_DETAIL = process.env.SRP_SCHEDULER_ENABLE_SALES_DETAIL !== 'false';
const SALES_DETAIL_DELAY_MS = Number(process.env.SRP_SCHEDULER_SALES_DELAY_MS || 0);
const JOB_TIMEOUT_MS = Number(process.env.SRP_SCHEDULER_JOB_TIMEOUT_MS || 5 * 60 * 1000);
const STALE_MINUTES = Number(process.env.SRP_SCHEDULER_STALE_MINUTES || 90);
const DEFAULT_PAUSED = process.env.SRP_SCHEDULER_DEFAULT_PAUSED !== 'false';

let isRunning = false;
let isPaused = DEFAULT_PAUSED;
let cronTask = null;

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

const runScheduledSync = async () => {
  if (isPaused) {
    console.warn('⚠️ Scheduler run skipped because scheduler is paused');
    return;
  }

  if (isRunning) {
    console.warn('⚠️ Scheduler run skipped because previous job is still running');
    return;
  }

  const targetDate = formatDate(new Date());

  try {
    isRunning = true;
    console.log(`🚀 Scheduler run started for ${targetDate}`);
    const marked = await markStaleRunningLogs({ olderThanMinutes: STALE_MINUTES });
    if (marked > 0) {
      console.warn(`⚠️ Marked ${marked} stale SRP logs as timeout`);
    }

    const branches = srpService.getBranches();

    if (!branches.length) {
      console.warn('⚠️ No SNJ branches configured, skipping scheduler run');
      return;
    }

    for (const branch of branches) {
      await runInventoryJob({ branch, targetDate });
      await runSalesDetailJob({ branch, targetDate });
    }

    console.log(`✅ Scheduler run completed for ${targetDate}`);
  } catch (error) {
    console.error('❌ Scheduler run failed:', error);
  } finally {
    isRunning = false;
  }
};

// Initialize scheduler
function initScheduler() {
  if (cronTask) {
    cronTask.stop();
  }

  cronTask = cron.schedule(SCHEDULER_CRON, async () => {
    console.log('⏰ Scheduler tick at', new Date().toISOString());
    await runScheduledSync();
  });

  if (isPaused && cronTask) {
    cronTask.stop();
    console.log('⏸️ Scheduler initialized in paused state');
  }

  console.log(`📅 Scheduler initialized - running on cron "${SCHEDULER_CRON}"`);
}

const pauseScheduler = () => {
  isPaused = true;
  if (cronTask) {
    cronTask.stop();
  }
  console.log('⏸️ Scheduler paused');
  return getSchedulerStatus();
};

const resumeScheduler = () => {
  isPaused = false;
  if (cronTask) {
    cronTask.start();
  }
  console.log('▶️ Scheduler resumed');
  return getSchedulerStatus();
};

const getSchedulerStatus = () => ({
  cron: SCHEDULER_CRON,
  running: isRunning,
  paused: isPaused,
});

module.exports = {
  initScheduler,
  runScheduledSync,
  pauseScheduler,
  resumeScheduler,
  getSchedulerStatus,
};
