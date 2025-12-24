const { getSrpPool } = require('../config/database');

let schemaPrepared = false;

const ensureSchema = async (client) => {
  if (schemaPrepared) return;

  await client.query(`
    CREATE TABLE IF NOT EXISTS snj_sales_detail (
      id BIGINT PRIMARY KEY,
      store_code VARCHAR(100),
      trans_type VARCHAR(50),
      org_code_name VARCHAR(100),
      bill_no VARCHAR(120),
      cashier TEXT,
      pos_machine TEXT,
      shift_name TEXT,
      shift_label TEXT,
      bill_date_time TEXT,
      sales_date DATE,
      sales_type VARCHAR(50),
      cust_name TEXT,
      cust_phone TEXT,
      item_code VARCHAR(100),
      barcode VARCHAR(150),
      item_name TEXT,
      item_long_name TEXT,
      department TEXT,
      category TEXT,
      class TEXT,
      vendor TEXT,
      location TEXT,
      unit VARCHAR(50),
      unit_cost_price NUMERIC,
      unit_sell_price NUMERIC,
      qty NUMERIC,
      customer_paid_amount NUMERIC,
      gross_amount NUMERIC,
      net_amount NUMERIC,
      discount_dtl NUMERIC,
      gross_sell NUMERIC,
      tax NUMERIC,
      net_sales NUMERIC,
      cost NUMERIC,
      margin NUMERIC,
      gpm VARCHAR(50),
      raw_payload JSONB,
      fetched_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snj_sales_detail_store_code
      ON snj_sales_detail (store_code)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snj_sales_detail_sales_date
      ON snj_sales_detail (sales_date)
  `);

  schemaPrepared = true;
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const mapRecord = (item, { storeCode }) => ({
  id: item.id,
  store_code: item.org_code_name || storeCode || null,
  trans_type: item.trans_type || null,
  org_code_name: item.org_code_name || null,
  bill_no: item.bill_no || null,
  cashier: item.cashier || null,
  pos_machine: item.pos_machine || null,
  shift_name: item.shift_name || null,
  shift_label: item.shift_label || null,
  bill_date_time: item.bill_date_time || null,
  sales_date: item.sales_date || null,
  sales_type: item.sales_type || null,
  cust_name: item.cust_name || null,
  cust_phone: item.cust_phone || null,
  item_code: item.item_code || null,
  barcode: item.barcode || null,
  item_name: item.item_name || null,
  item_long_name: item.item_long_name || null,
  department: item.department || null,
  category: item.category || null,
  class: item.class || null,
  vendor: item.vendor || null,
  location: item.location || null,
  unit: item.unit || null,
  unit_cost_price: toNullableNumber(item.unit_cost_price),
  unit_sell_price: toNullableNumber(item.unit_sell_price),
  qty: toNullableNumber(item.qty),
  customer_paid_amount: toNullableNumber(item.customer_paid_amount),
  gross_amount: toNullableNumber(item.gross_amount),
  net_amount: toNullableNumber(item.net_amount),
  discount_dtl: toNullableNumber(item.discount_dtl),
  gross_sell: toNullableNumber(item.gross_sell),
  tax: toNullableNumber(item.tax),
  net_sales: toNullableNumber(item.net_sales),
  cost: toNullableNumber(item.cost),
  margin: toNullableNumber(item.margin),
  gpm: item.gpm || null,
  raw_payload: item,
});

const buildUpsertQuery = (records) => {
  const columns = [
    'id',
    'store_code',
    'trans_type',
    'org_code_name',
    'bill_no',
    'cashier',
    'pos_machine',
    'shift_name',
    'shift_label',
    'bill_date_time',
    'sales_date',
    'sales_type',
    'cust_name',
    'cust_phone',
    'item_code',
    'barcode',
    'item_name',
    'item_long_name',
    'department',
    'category',
    'class',
    'vendor',
    'location',
    'unit',
    'unit_cost_price',
    'unit_sell_price',
    'qty',
    'customer_paid_amount',
    'gross_amount',
    'net_amount',
    'discount_dtl',
    'gross_sell',
    'tax',
    'net_sales',
    'cost',
    'margin',
    'gpm',
    'raw_payload',
  ];

  const values = [];
  const rows = records.map((record, index) => {
    const baseIndex = index * columns.length;
    columns.forEach((column, columnIndex) => {
      values.push(record[column]);
    });

    const placeholders = columns
      .map((_, columnIndex) => `$${baseIndex + columnIndex + 1}`)
      .join(', ');

    return `(${placeholders}, NOW())`;
  });

  const query = `
    INSERT INTO snj_sales_detail (${columns.join(', ')}, fetched_at)
    VALUES ${rows.join(', ')}
    ON CONFLICT (id)
    DO UPDATE SET
      store_code = EXCLUDED.store_code,
      trans_type = EXCLUDED.trans_type,
      org_code_name = EXCLUDED.org_code_name,
      bill_no = EXCLUDED.bill_no,
      cashier = EXCLUDED.cashier,
      pos_machine = EXCLUDED.pos_machine,
      shift_name = EXCLUDED.shift_name,
      shift_label = EXCLUDED.shift_label,
      bill_date_time = EXCLUDED.bill_date_time,
      sales_date = EXCLUDED.sales_date,
      sales_type = EXCLUDED.sales_type,
      cust_name = EXCLUDED.cust_name,
      cust_phone = EXCLUDED.cust_phone,
      item_code = EXCLUDED.item_code,
      barcode = EXCLUDED.barcode,
      item_name = EXCLUDED.item_name,
      item_long_name = EXCLUDED.item_long_name,
      department = EXCLUDED.department,
      category = EXCLUDED.category,
      class = EXCLUDED.class,
      vendor = EXCLUDED.vendor,
      location = EXCLUDED.location,
      unit = EXCLUDED.unit,
      unit_cost_price = EXCLUDED.unit_cost_price,
      unit_sell_price = EXCLUDED.unit_sell_price,
      qty = EXCLUDED.qty,
      customer_paid_amount = EXCLUDED.customer_paid_amount,
      gross_amount = EXCLUDED.gross_amount,
      net_amount = EXCLUDED.net_amount,
      discount_dtl = EXCLUDED.discount_dtl,
      gross_sell = EXCLUDED.gross_sell,
      tax = EXCLUDED.tax,
      net_sales = EXCLUDED.net_sales,
      cost = EXCLUDED.cost,
      margin = EXCLUDED.margin,
      gpm = EXCLUDED.gpm,
      raw_payload = EXCLUDED.raw_payload,
      fetched_at = NOW()
    RETURNING (xmax = 0) AS inserted;
  `;

  return { query, values };
};

const saveSalesDetailRecords = async (rawItems, options = {}) => {
  const {
    truncateBeforeInsert = false,
    chunkSize = 300,
    storeCode = null,
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
      await client.query('TRUNCATE TABLE snj_sales_detail RESTART IDENTITY');
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (let index = 0; index < rawItems.length; index += chunkSize) {
      const chunk = rawItems.slice(index, index + chunkSize)
        .map((item) => mapRecord(item, { storeCode }));

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
  saveSalesDetailRecords,
};
