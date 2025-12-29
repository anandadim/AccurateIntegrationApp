const { getSrpPool } = require('../config/database');

let schemaPrepared = false;

const ensureSchema = async (client) => {
  if (schemaPrepared) {
    return;
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS srp_fetch_logs (
      id BIGSERIAL PRIMARY KEY,
      branch_id VARCHAR(50),
      store_code VARCHAR(100),
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
    CREATE INDEX IF NOT EXISTS idx_srp_fetch_logs_target
      ON srp_fetch_logs (target_date, data_type)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_srp_fetch_logs_status
      ON srp_fetch_logs (status)
  `);

  schemaPrepared = true;
};

const getClient = async () => {
  const pool = getSrpPool();
  return pool.connect();
};

const startLog = async ({ branchId, storeCode, dataType, targetDate, metadata = null }) => {
  if (!dataType) {
    throw new Error('dataType is required to create fetch log');
  }
  if (!targetDate) {
    throw new Error('targetDate is required to create fetch log');
  }

  const client = await getClient();

  try {
    await ensureSchema(client);
    const { rows } = await client.query(
      `
        INSERT INTO srp_fetch_logs (branch_id, store_code, data_type, target_date, status, metadata)
        VALUES ($1, $2, $3, $4, 'running', $5)
        RETURNING id
      `,
      [branchId || null, storeCode || null, dataType, targetDate, metadata]
    );

    return rows[0].id;
  } finally {
    client.release();
  }
};

const finishLog = async (id, { status, rowsFetched = null, errorMessage = null }) => {
  if (!id) {
    return;
  }

  const client = await getClient();

  try {
    await ensureSchema(client);
    await client.query(
      `
        UPDATE srp_fetch_logs
        SET
          status = $2,
          rows_fetched = COALESCE($3::int, rows_fetched),
          error_message = $4,
          finished_at = NOW()
        WHERE id = $1
      `,
      [id, status, rowsFetched, errorMessage]
    );
  } finally {
    client.release();
  }
};

const markSuccess = async (id, rowsFetched = 0) => {
  await finishLog(id, { status: 'success', rowsFetched, errorMessage: null });
};

const markFailure = async (id, error) => {
  const message = error instanceof Error
    ? `${error.message}${error.stack ? `\n${error.stack}` : ''}`
    : String(error);
  await finishLog(id, { status: 'failed', rowsFetched: null, errorMessage: message });
};

const markStaleRunningLogs = async ({ olderThanMinutes = 60, newStatus = 'timeout' } = {}) => {
  const minutes = Math.max(1, Number(olderThanMinutes) || 60);
  const status = newStatus || 'timeout';

  const client = await getClient();

  try {
    await ensureSchema(client);
    const { rowCount } = await client.query(
      `
        UPDATE srp_fetch_logs
        SET
          status = $1::text,
          error_message = COALESCE(
            error_message,
            CONCAT('Automatically marked as ', $1::text, ' after exceeding ', $2::int, ' minutes')
          ),
          finished_at = NOW()
        WHERE status = 'running'
          AND started_at < NOW() - ($2::int * INTERVAL '1 minute')
      `,
      [status, minutes]
    );

    return rowCount;
  } finally {
    client.release();
  }
};

const getRecentLogs = async ({ limit = 20, statuses = null } = {}) => {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const hasStatuses = Array.isArray(statuses) && statuses.length > 0;
  const client = await getClient();

  try {
    await ensureSchema(client);

    const params = [];
    let whereClause = '';

    if (hasStatuses) {
      whereClause = 'WHERE status = ANY($1)';
      params.push(statuses);
    }

    params.push(normalizedLimit);
    const limitPlaceholder = `$${params.length}`;

    const queryText = `
      SELECT
        id,
        branch_id AS "branchId",
        store_code AS "storeCode",
        data_type AS "dataType",
        target_date AS "targetDate",
        status,
        rows_fetched AS "rowsFetched",
        error_message AS "errorMessage",
        started_at AS "startedAt",
        finished_at AS "finishedAt",
        metadata
      FROM srp_fetch_logs
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT ${limitPlaceholder}
    `;

    const { rows } = await client.query(queryText, params);
    return rows;
  } finally {
    client.release();
  }
};

module.exports = {
  startLog,
  markSuccess,
  markFailure,
  markStaleRunningLogs,
  getRecentLogs,
};
