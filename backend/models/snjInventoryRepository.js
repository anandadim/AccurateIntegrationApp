const { getSrpPool } = require('../config/database');

let schemaPrepared = false;

const ensureSchema = async (client) => {
  if (schemaPrepared) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS snj_inventory (
      id SERIAL PRIMARY KEY,
      item_id BIGINT,
      item_article_code VARCHAR(100) NOT NULL,
      item_name TEXT,
      item_uom VARCHAR(50),
      location_id BIGINT,
      location_code VARCHAR(50) NOT NULL,
      location_name TEXT,
      storage_location_id BIGINT,
      storage_location_code VARCHAR(50) NOT NULL DEFAULT '',
      storage_location_name TEXT,
      total_current_stock NUMERIC,
      mav NUMERIC,
      value NUMERIC,
      source_endpoint VARCHAR(50) NOT NULL DEFAULT 'by-location',
      raw_payload JSONB,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (location_code, storage_location_code, item_article_code)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snj_inventory_article
      ON snj_inventory (item_article_code)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snj_inventory_location
      ON snj_inventory (location_code)
  `);

  schemaPrepared = true;
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const mapRecord = (item, sourceEndpoint) => {
  if (!item.location_code) {
    throw new Error('SNJ inventory record is missing location_code');
  }
  if (!item.item_article_code) {
    throw new Error('SNJ inventory record is missing item_article_code');
  }

  return {
    item_id: item.item_id ?? null,
    item_article_code: item.item_article_code,
    item_name: item.item_name ?? null,
    item_uom: item.item_uom ?? null,
    location_id: item.location_id ?? null,
    location_code: item.location_code,
    location_name: item.location_name ?? null,
    storage_location_id: item.storage_location_id ?? null,
    storage_location_code: item.storage_location_code || '',
    storage_location_name: item.storage_location_name ?? null,
    total_current_stock: toNullableNumber(item.total_current_stock),
    mav: toNullableNumber(item.mav),
    value: toNullableNumber(item.value),
    source_endpoint: sourceEndpoint,
    raw_payload: item,
  };
};

const buildUpsertQuery = (records) => {
  const columns = [
    'item_id',
    'item_article_code',
    'item_name',
    'item_uom',
    'location_id',
    'location_code',
    'location_name',
    'storage_location_id',
    'storage_location_code',
    'storage_location_name',
    'total_current_stock',
    'mav',
    'value',
    'source_endpoint',
    'raw_payload',
  ];

  const values = [];
  const rows = records.map((record, index) => {
    const baseIndex = index * columns.length;
    columns.forEach((column, colIndex) => {
      values.push(record[column]);
    });

    const placeholders = columns
      .map((_, colIndex) => `$${baseIndex + colIndex + 1}`)
      .join(', ');

    return `(${placeholders}, NOW())`;
  });

  const query = `
    INSERT INTO snj_inventory (${columns.join(', ')}, fetched_at)
    VALUES ${rows.join(', ')}
    ON CONFLICT (location_code, storage_location_code, item_article_code)
    DO UPDATE SET
      item_id = EXCLUDED.item_id,
      item_name = EXCLUDED.item_name,
      item_uom = EXCLUDED.item_uom,
      location_id = EXCLUDED.location_id,
      location_name = EXCLUDED.location_name,
      storage_location_id = EXCLUDED.storage_location_id,
      storage_location_name = EXCLUDED.storage_location_name,
      total_current_stock = EXCLUDED.total_current_stock,
      mav = EXCLUDED.mav,
      value = EXCLUDED.value,
      source_endpoint = EXCLUDED.source_endpoint,
      raw_payload = EXCLUDED.raw_payload,
      fetched_at = NOW()
    RETURNING (xmax = 0) AS inserted;
  `;

  return { query, values };
};

const saveInventoryRecords = async (rawItems, options = {}) => {
  const {
    truncateBeforeInsert = false,
    sourceEndpoint = 'by-location',
    chunkSize = 500,
  } = options;

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      totalRecords: 0,
      insertedCount: 0,
      updatedCount: 0,
    };
  }

  const pool = getSrpPool();
  const client = await pool.connect();

  try {
    await ensureSchema(client);
    await client.query('BEGIN');

    if (truncateBeforeInsert) {
      await client.query('TRUNCATE TABLE snj_inventory RESTART IDENTITY');
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (let i = 0; i < rawItems.length; i += chunkSize) {
      const chunk = rawItems.slice(i, i + chunkSize)
        .map((item) => mapRecord(item, sourceEndpoint));

      const { query, values } = buildUpsertQuery(chunk);
      const result = await client.query(query, values);

      const chunkInserted = result.rows.filter((row) => row.inserted === true || row.inserted === 't').length;
      insertedCount += chunkInserted;
      updatedCount += result.rows.length - chunkInserted;
    }

    await client.query('COMMIT');

    return {
      totalRecords: rawItems.length,
      insertedCount,
      updatedCount,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  saveInventoryRecords,
};
