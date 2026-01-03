const cron = require('node-cron');
const srpService = require('./srpService');
const accurateService = require('./accurateService');
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

const SCHEDULER_CRON = process.env.SRP_SCHEDULER_CRON || '*/20 * * * *';
const ENABLE_INVENTORY = process.env.SRP_SCHEDULER_ENABLE_INVENTORY !== 'false';
const ENABLE_SALES_DETAIL = process.env.SRP_SCHEDULER_ENABLE_SALES_DETAIL !== 'false';
const SALES_DETAIL_DELAY_MS = Number(process.env.SRP_SCHEDULER_SALES_DELAY_MS || 0);
const JOB_TIMEOUT_MS = Number(process.env.SRP_SCHEDULER_JOB_TIMEOUT_MS || 5 * 60 * 1000);
const STALE_MINUTES = Number(process.env.SRP_SCHEDULER_STALE_MINUTES || 90);
const DEFAULT_PAUSED = process.env.SRP_SCHEDULER_DEFAULT_PAUSED === 'true';

// Accurate Scheduler Settings
const ENABLE_ACCURATE = process.env.ACCURATE_SCHEDULER_ENABLE !== 'false';
const ENABLE_SALES_INVOICE = process.env.ACCURATE_SCHEDULER_ENABLE_SALES_INVOICE !== 'false';
const ENABLE_SALES_RECEIPT = process.env.ACCURATE_SCHEDULER_ENABLE_SALES_RECEIPT !== 'false';
const ENABLE_SALES_ORDER = process.env.ACCURATE_SCHEDULER_ENABLE_SALES_ORDER !== 'false';
const ACCURATE_BATCH_SIZE = Number(process.env.ACCURATE_SCHEDULER_BATCH_SIZE || 50);
const ACCURATE_BATCH_DELAY = Number(process.env.ACCURATE_SCHEDULER_BATCH_DELAY || 300);

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
        branch.name
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
      accurateService.fetchListWithDetails(
        'sales-receipt',
        branch.dbId,
        {
          dateFrom: targetDate,
          dateTo: targetDate,
          dateFilterType: 'transDate',
          batchSize: ACCURATE_BATCH_SIZE,
          batchDelay: ACCURATE_BATCH_DELAY
        },
        branch.id
      ),
      JOB_TIMEOUT_MS,
      `[SalesReceipt] Branch ${branch.id}`
    );

    const fetched = result?.items?.length ?? 0;
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
        branch.name
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
    
    // Mark stale SRP logs
    const srpMarked = await markStaleRunningLogs({ olderThanMinutes: STALE_MINUTES });
    if (srpMarked > 0) {
      console.warn(`⚠️ Marked ${srpMarked} stale SRP logs as timeout`);
    }

    // Mark stale Accurate logs
    const accurateMarked = await markAccurateStaleRunningLogs({ olderThanMinutes: STALE_MINUTES });
    if (accurateMarked > 0) {
      console.warn(`⚠️ Marked ${accurateMarked} stale Accurate logs as timeout`);
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

    // Accurate Branches
    if (ENABLE_ACCURATE) {
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
    } else {
      console.log('⚠️ Accurate scheduler is disabled');
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

  // Only start the cron task if not paused
  if (isPaused && cronTask) {
    cronTask.stop();
    console.log('⏸️ Scheduler initialized in paused state');
  } else if (!isPaused && cronTask) {
    console.log('▶️ Scheduler initialized and started automatically');
  }

  console.log(`📅 Scheduler initialized - running on cron "${SCHEDULER_CRON}"`);
  console.log(`🔧 SRP Settings: ENABLE_INVENTORY=${ENABLE_INVENTORY}, ENABLE_SALES_DETAIL=${ENABLE_SALES_DETAIL}, DEFAULT_PAUSED=${DEFAULT_PAUSED}`);
  console.log(`🔧 Accurate Settings: ENABLE_ACCURATE=${ENABLE_ACCURATE}, ENABLE_SALES_INVOICE=${ENABLE_SALES_INVOICE}, ENABLE_SALES_RECEIPT=${ENABLE_SALES_RECEIPT}, ENABLE_SALES_ORDER=${ENABLE_SALES_ORDER}`);
  console.log(`🔧 Batch Settings: SIZE=${ACCURATE_BATCH_SIZE}, DELAY=${ACCURATE_BATCH_DELAY}ms`);
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
