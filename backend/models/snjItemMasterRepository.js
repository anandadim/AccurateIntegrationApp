const { getSrpPool } = require('../config/database')

let schemaPrepared = false

const ensureSchema = async (client) => {
  if (schemaPrepared) return

  await client.query(`
    CREATE TABLE IF NOT EXISTS snj_item_master (
      id SERIAL PRIMARY KEY,
      item_master_id BIGINT,
      article_code VARCHAR(100) NOT NULL,
      article_code_iretail VARCHAR(100),
      article_description TEXT,
      base_unit_of_measure VARCHAR(50),
      is_active BOOLEAN,
      created_on TIMESTAMPTZ,
      created_by BIGINT,
      entity_code VARCHAR(32),
      class_id BIGINT,
      class_name TEXT,
      subclass_id BIGINT,
      subclass_name TEXT,
      product_class_id BIGINT,
      product_class_name TEXT,
      department_id BIGINT,
      department_name TEXT,
      area_id BIGINT,
      area_code VARCHAR(50),
      area_name TEXT,
      barcodes JSONB,
      raw_payload JSONB,
      fetched_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(article_code, entity_code)
    )
  `)

  await client.query(`
    ALTER TABLE snj_item_master
    DROP COLUMN IF EXISTS branch_id,
    DROP COLUMN IF EXISTS branch_name
  `)

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snj_item_master_article
      ON snj_item_master (article_code)
  `)

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snj_item_master_description
      ON snj_item_master USING GIN (to_tsvector('simple', coalesce(article_description, '')))
  `)

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_snj_item_master_entity
      ON snj_item_master (entity_code)
  `)

  schemaPrepared = true
}

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const toNullableString = (value) => {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str.length ? str : null
}

const toNullableDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const tryParseJsonLoosely = (value) => {
  if (typeof value !== 'string') return null

  let candidate = value.trim()
  if (!candidate) return null

  const seen = new Set()

  while (candidate && !seen.has(candidate)) {
    seen.add(candidate)

    try {
      return JSON.parse(candidate)
    } catch (error) {
      const startsWithBrace = candidate.startsWith('{') || candidate.startsWith('[')
      const endsWithQuote = candidate.endsWith('"') || candidate.endsWith('\'')
      const wrappedWithQuotes = (candidate.startsWith('"') && candidate.endsWith('"')) ||
        (candidate.startsWith('\'') && candidate.endsWith('\''))

      if (wrappedWithQuotes) {
        candidate = candidate.slice(1, -1).trim()
        continue
      }

      if (startsWithBrace && endsWithQuote) {
        candidate = candidate.slice(0, -1).trim()
        continue
      }

      break
    }
  }

  return null
}

const normalizeJsonValue = (value) => {
  if (value === undefined) return null
  if (value === null) return null

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeJsonValue(entry))
      .filter((entry) => entry !== null && entry !== undefined)
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value && typeof value === 'object') {
    const normalized = {}
    for (const [key, val] of Object.entries(value)) {
      const normalizedValue = normalizeJsonValue(val)
      if (normalizedValue !== null && normalizedValue !== undefined) {
        normalized[key] = normalizedValue
      }
    }
    return normalized
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''

    const parsed = tryParseJsonLoosely(trimmed)
    if (parsed !== null && parsed !== undefined) {
      if (typeof parsed === 'string') {
        if (parsed !== trimmed) {
          return normalizeJsonValue(parsed)
        }
      } else {
        return normalizeJsonValue(parsed)
      }
    }

    return trimmed
  }

  return value
}

const normalizeBarcodes = (barcodes) => {
  const normalized = normalizeJsonValue(barcodes)

  if (!normalized) {
    return []
  }

  if (Array.isArray(normalized)) {
    return normalized
  }

  if (typeof normalized === 'object') {
    return [normalized]
  }

  const parsed = typeof normalized === 'string' ? tryParseJsonLoosely(normalized) : null
  if (parsed && Array.isArray(parsed)) {
    return parsed
  }

  if (parsed && typeof parsed === 'object') {
    return [parsed]
  }

  return []
}

const sanitizeItemPayload = (item, sanitizedBarcodes) => {
  const cloned = {
    ...item,
    barcodes: sanitizedBarcodes,
  }

  const normalized = normalizeJsonValue(cloned)

  if (normalized && typeof normalized === 'object') {
    return normalized
  }

  if (typeof normalized === 'string') {
    const parsed = tryParseJsonLoosely(normalized)
    if (parsed && typeof parsed === 'object') {
      return normalizeJsonValue(parsed)
    }
  }

  return {
    raw: normalized ?? null,
  }
}

const mapItemMasterRecord = (item = {}) => {
  if (!item.article_code) {
    throw new Error('SNJ item master record missing article_code')
  }

  const cls = item.class || {}
  const subclass = item.subclass || {}
  const productClass = subclass.productClass || {}
  const department = item.department || {}
  const area = item.area || {}

  const sanitizedBarcodes = normalizeBarcodes(item.barcodes)
  const sanitizedPayload = sanitizeItemPayload(item, sanitizedBarcodes)

  return {
    item_master_id: toNullableNumber(item.id),
    article_code: item.article_code,
    article_code_iretail: toNullableString(item.article_code_iretail),
    article_description: toNullableString(item.article_description),
    base_unit_of_measure: toNullableString(item.base_unit_of_measure),
    is_active: item.is_active === 1 || item.is_active === true,
    created_on: toNullableDate(item.created_on),
    created_by: toNullableNumber(item.created_by),
    entity_code: toNullableString(item.entity_code),
    class_id: toNullableNumber(cls.id),
    class_name: toNullableString(cls.name),
    subclass_id: toNullableNumber(subclass.id),
    subclass_name: toNullableString(subclass.name),
    product_class_id: toNullableNumber(productClass.id),
    product_class_name: toNullableString(productClass.name),
    department_id: toNullableNumber(department.id),
    department_name: toNullableString(department.name),
    area_id: toNullableNumber(area.id),
    area_code: toNullableString(area.code),
    area_name: toNullableString(area.name),
    barcodes: sanitizedBarcodes,
    raw_payload: sanitizedPayload,
  }
}

const buildUpsertQuery = (records) => {
  const columns = [
    'item_master_id',
    'article_code',
    'article_code_iretail',
    'article_description',
    'base_unit_of_measure',
    'is_active',
    'created_on',
    'created_by',
    'entity_code',
    'class_id',
    'class_name',
    'subclass_id',
    'subclass_name',
    'product_class_id',
    'product_class_name',
    'department_id',
    'department_name',
    'area_id',
    'area_code',
    'area_name',
    'barcodes',
    'raw_payload',
  ]

  const values = []
  const rows = records.map((record, index) => {
    const baseIndex = index * columns.length
    columns.forEach((column) => {
      values.push(record[column])
    })

    const placeholders = columns
      .map((_, colIndex) => `$${baseIndex + colIndex + 1}`)
      .join(', ')

    return `(${placeholders}, NOW())`
  })

  const query = `
    INSERT INTO snj_item_master (${columns.join(', ')}, fetched_at)
    VALUES ${rows.join(', ')}
    ON CONFLICT (article_code, entity_code)
    DO UPDATE SET
      item_master_id = EXCLUDED.item_master_id,
      article_code_iretail = EXCLUDED.article_code_iretail,
      article_description = EXCLUDED.article_description,
      base_unit_of_measure = EXCLUDED.base_unit_of_measure,
      is_active = EXCLUDED.is_active,
      created_on = EXCLUDED.created_on,
      created_by = EXCLUDED.created_by,
      class_id = EXCLUDED.class_id,
      class_name = EXCLUDED.class_name,
      subclass_id = EXCLUDED.subclass_id,
      subclass_name = EXCLUDED.subclass_name,
      product_class_id = EXCLUDED.product_class_id,
      product_class_name = EXCLUDED.product_class_name,
      department_id = EXCLUDED.department_id,
      department_name = EXCLUDED.department_name,
      area_id = EXCLUDED.area_id,
      area_code = EXCLUDED.area_code,
      area_name = EXCLUDED.area_name,
      barcodes = EXCLUDED.barcodes,
      raw_payload = EXCLUDED.raw_payload,
      fetched_at = NOW()
    RETURNING (xmax = 0) AS inserted;
  `

  return { query, values }
}

const saveItemMasterRecords = async (rawItems, options = {}) => {
  const {
    truncateBeforeInsert = false,
    chunkSize = 500,
  } = options

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      totalRecords: 0,
      insertedCount: 0,
      updatedCount: 0,
    }
  }

  const pool = getSrpPool()
  const client = await pool.connect()

  try {
    await ensureSchema(client)
    await client.query('BEGIN')

    if (truncateBeforeInsert) {
      await client.query('TRUNCATE TABLE snj_item_master RESTART IDENTITY')
    }

    let insertedCount = 0
    let updatedCount = 0

    for (let i = 0; i < rawItems.length; i += chunkSize) {
      const chunkRaw = rawItems.slice(i, i + chunkSize)
      const chunk = chunkRaw.map((item) => mapItemMasterRecord(item))

      const dedupedChunk = []
      const seenKeys = new Set()
      for (const record of chunk) {
        const key = `${record.article_code}|${record.entity_code || ''}`
        if (!seenKeys.has(key)) {
          seenKeys.add(key)
          dedupedChunk.push(record)
        }
      }

      const { query, values } = buildUpsertQuery(dedupedChunk)

      let result
      const savepointName = `chunk_savepoint_${i}`
      await client.query(`SAVEPOINT ${savepointName}`)
      try {
        result = await client.query(query, values)
        await client.query(`RELEASE SAVEPOINT ${savepointName}`)
      } catch (err) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`)

        const sampleOriginal = chunkRaw[0]
        const sampleMapped = chunk[0]

        console.error('❌ Failed to persist SNJ item master chunk', {
          chunkSize: chunk.length,
          error: err.message,
          sampleOriginal: sampleOriginal ? JSON.stringify(sampleOriginal).slice(0, 2000) : null,
          sampleMapped: sampleMapped ? JSON.stringify(sampleMapped).slice(0, 2000) : null,
        })

        const fallbackRecords = chunk.map((record) => ({
          ...record,
          barcodes: null,
          raw_payload: record.raw_payload ? { raw: typeof record.raw_payload === 'string' ? record.raw_payload.slice(0, 2000) : record.raw_payload } : null,
        }))

        const dedupedFallbackRecords = []
        const seenFallbackKeys = new Set()
        for (const record of fallbackRecords) {
          const key = `${record.article_code}|${record.entity_code || ''}`
          if (!seenFallbackKeys.has(key)) {
            seenFallbackKeys.add(key)
            dedupedFallbackRecords.push(record)
          }
        }

        const fallbackValues = []
        const columns = [
          'item_master_id',
          'article_code',
          'article_code_iretail',
          'article_description',
          'base_unit_of_measure',
          'is_active',
          'created_on',
          'created_by',
          'entity_code',
          'class_id',
          'class_name',
          'subclass_id',
          'subclass_name',
          'product_class_id',
          'product_class_name',
          'department_id',
          'department_name',
          'area_id',
          'area_code',
          'area_name',
          'barcodes',
          'raw_payload',
        ]

        const fallbackRows = dedupedFallbackRecords.map((record, index) => {
          const baseIndex = index * columns.length
          columns.forEach((column) => {
            fallbackValues.push(record[column])
          })

          const placeholders = columns
            .map((_, colIndex) => `$${baseIndex + colIndex + 1}`)
            .join(', ')

          return `(${placeholders}, NOW())`
        })

        const fallbackQuery = `
          INSERT INTO snj_item_master (${columns.join(', ')}, fetched_at)
          VALUES ${fallbackRows.join(', ')}
          ON CONFLICT (article_code, entity_code)
          DO UPDATE SET
            item_master_id = EXCLUDED.item_master_id,
            article_code_iretail = EXCLUDED.article_code_iretail,
            article_description = EXCLUDED.article_description,
            base_unit_of_measure = EXCLUDED.base_unit_of_measure,
            is_active = EXCLUDED.is_active,
            created_on = EXCLUDED.created_on,
            created_by = EXCLUDED.created_by,
            class_id = EXCLUDED.class_id,
            class_name = EXCLUDED.class_name,
            subclass_id = EXCLUDED.subclass_id,
            subclass_name = EXCLUDED.subclass_name,
            product_class_id = EXCLUDED.product_class_id,
            product_class_name = EXCLUDED.product_class_name,
            department_id = EXCLUDED.department_id,
            department_name = EXCLUDED.department_name,
            area_id = EXCLUDED.area_id,
            area_code = EXCLUDED.area_code,
            area_name = EXCLUDED.area_name,
            barcodes = EXCLUDED.barcodes,
            raw_payload = EXCLUDED.raw_payload,
            fetched_at = NOW()
          RETURNING (xmax = 0) AS inserted;
        `

        const fallbackSavepointName = `${savepointName}_fallback`
        await client.query(`SAVEPOINT ${fallbackSavepointName}`)
        try {
          result = await client.query(fallbackQuery, fallbackValues)
          await client.query(`RELEASE SAVEPOINT ${fallbackSavepointName}`)
        } catch (fallbackErr) {
          await client.query(`ROLLBACK TO SAVEPOINT ${fallbackSavepointName}`)
          console.error('❌ Fallback query also failed for SNJ item master chunk', {
            chunkSize: chunk.length,
            error: fallbackErr.message,
          })
          throw fallbackErr
        }
      }

      const chunkInserted = result.rows.filter((row) => row.inserted === true || row.inserted === 't').length
      insertedCount += chunkInserted
      updatedCount += result.rows.length - chunkInserted
    }

    await client.query('COMMIT')

    return {
      totalRecords: rawItems.length,
      insertedCount,
      updatedCount,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const getItemMasterRecords = async ({
  search = null,
  entityCode = null,
  articleCode = null,
  perPage = 50,
  page = 1,
} = {}) => {
  const pool = getSrpPool()
  const client = await pool.connect()

  try {
    await ensureSchema(client)

    const conditions = []
    const values = []

    if (search) {
      const likeValue = `%${search}%`
      conditions.push(`(article_code ILIKE $${values.length + 1} OR article_description ILIKE $${values.length + 2})`)
      values.push(likeValue, likeValue)
    }

    if (entityCode) {
      conditions.push(`entity_code = $${values.length + 1}`)
      values.push(entityCode)
    }

    if (articleCode) {
      conditions.push(`article_code = $${values.length + 1}`)
      values.push(articleCode)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const limit = Math.max(1, Number(perPage) || 50)
    const currentPage = Math.max(1, Number(page) || 1)
    const offset = (currentPage - 1) * limit

    values.push(limit, offset)

    const result = await client.query(
      `
        SELECT
          id,
          item_master_id,
          article_code,
          article_code_iretail,
          article_description,
          base_unit_of_measure,
          is_active,
          created_on,
          created_by,
          entity_code,
          class_id,
          class_name,
          subclass_id,
          subclass_name,
          product_class_id,
          product_class_name,
          department_id,
          department_name,
          area_id,
          area_code,
          area_name,
          barcodes,
          raw_payload,
          fetched_at,
          COUNT(*) OVER() AS total_count
        FROM snj_item_master
        ${whereClause}
        ORDER BY article_code ASC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
      `,
      values
    )

    const rows = result.rows || []
    const total = rows.length ? Number(rows[0].total_count) : 0
    const lastPage = total > 0 ? Math.ceil(total / limit) : 1

    return {
      items: rows.map((row) => ({
        ...row,
        barcodes: row.barcodes || [],
      })),
      pagination: {
        total,
        perPage: limit,
        page: currentPage,
        lastPage,
        from: total === 0 ? 0 : offset + 1,
        to: total === 0 ? 0 : offset + rows.length,
      },
    }
  } finally {
    client.release()
  }
}

module.exports = {
  saveItemMasterRecords,
  getItemMasterRecords,
}
