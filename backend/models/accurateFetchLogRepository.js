const { getClient: getAccurateClient } = require('../config/database');

let schemaPrepared = false;

const ensureSchema = async (client) => {
  if (schemaPrepared) {
    return;
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS accurate_fetch_logs (
      id BIGSERIAL PRIMARY KEY,
      branch_id VARCHAR(50),
      branch_name VARCHAR(100),
      data_type VARCHAR(50) NOT NULL,
      target_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL,
      rows_fetched INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      metadata JSONB
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_accurate_fetch_logs_target
      ON accurate_fetch_logs (target_date, data_type)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_accurate_fetch_logs_status
      ON accurate_fetch_logs (status)
  `);

  schemaPrepared = true;
};

const startLog = async ({ branchId, branchName, dataType, targetDate, metadata = null }) => {
  if (!dataType) {
    throw new Error('dataType is required to create fetch log');
  }
  if (!targetDate) {
    throw new Error('targetDate is required to create fetch log');
  }

  const client = await getAccurateClient();
  try {
    await ensureSchema(client);
    
    const result = await client.query(`
      INSERT INTO accurate_fetch_logs 
        (branch_id, branch_name, data_type, target_date, status, metadata)
      VALUES 
        ($1, $2, $3, $4, 'running', $5)
      RETURNING id
    `, [branchId, branchName, dataType, targetDate, metadata]);

    console.log(`📝 [AccurateLog] Started log for ${dataType} - branch ${branchId} (${branchName})`);
    return result.rows[0].id;
  } finally {
    client.release();
  }
};

const markSuccess = async (logId, rowsFetched = 0) => {
  if (!logId) {
    console.warn('⚠️ [AccurateLog] No logId provided for markSuccess');
    return;
  }

  const client = await getAccurateClient();
  try {
    await ensureSchema(client);
    
    const result = await client.query(`
      UPDATE accurate_fetch_logs 
      SET 
        status = 'success',
        rows_fetched = $2,
        finished_at = NOW()
      WHERE id = $1
    `, [logId, rowsFetched]);

    if (result.rowCount === 0) {
      console.warn(`⚠️ [AccurateLog] No log found with id ${logId}`);
    } else {
      console.log(`✅ [AccurateLog] Marked success for log ${logId} - ${rowsFetched} rows`);
    }
  } finally {
    client.release();
  }
};

const markFailure = async (logId, error) => {
  if (!logId) {
    console.warn('⚠️ [AccurateLog] No logId provided for markFailure');
    return;
  }

  const errorMessage = error?.message || String(error);
  
  const client = await getAccurateClient();
  try {
    await ensureSchema(client);
    
    const result = await client.query(`
      UPDATE accurate_fetch_logs 
      SET 
        status = 'failed',
        error_message = $2,
        finished_at = NOW()
      WHERE id = $1
    `, [logId, errorMessage]);

    if (result.rowCount === 0) {
      console.warn(`⚠️ [AccurateLog] No log found with id ${logId}`);
    } else {
      console.log(`❌ [AccurateLog] Marked failure for log ${logId} - ${errorMessage}`);
    }
  } finally {
    client.release();
  }
};

const getRecentLogs = async ({ limit = 20, statuses = null, branchId = null, dataType = null } = {}) => {
  const client = await getAccurateClient();
  try {
    await ensureSchema(client);
    
    let query = `
      SELECT 
        id,
        branch_id,
        branch_name,
        data_type,
        target_date,
        status,
        rows_fetched,
        error_message,
        started_at,
        finished_at,
        metadata
      FROM accurate_fetch_logs
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (statuses && statuses.length) {
      const statusPlaceholders = statuses.map(() => `$${paramIndex++}`).join(', ');
      query += ` AND status IN (${statusPlaceholders})`;
      params.push(...statuses);
    }

    if (branchId) {
      query += ` AND branch_id = $${paramIndex++}`;
      params.push(branchId);
    }

    if (dataType) {
      query += ` AND data_type = $${paramIndex++}`;
      params.push(dataType);
    }

    query += `
      ORDER BY started_at DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    const result = await client.query(query, params);
    
    return result.rows;
  } finally {
    client.release();
  }
};

const markStaleRunningLogs = async ({ olderThanMinutes = 90 } = {}) => {
  const client = await getAccurateClient();
  try {
    await ensureSchema(client);
    
    const result = await client.query(`
      UPDATE accurate_fetch_logs 
      SET 
        status = 'timeout',
        error_message = 'Job timed out',
        finished_at = NOW()
      WHERE 
        status = 'running' 
        AND started_at < NOW() - INTERVAL '${olderThanMinutes} minutes'
    `);

    return result.rowCount;
  } finally {
    client.release();
  }
};

module.exports = {
  startLog,
  markSuccess,
  markFailure,
  getRecentLogs,
  markStaleRunningLogs,
};
