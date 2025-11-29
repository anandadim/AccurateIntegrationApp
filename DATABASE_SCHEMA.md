# Database Schema - SQLite

## Tables

### 1. accurate_data
Menyimpan cache data dari Accurate Online API

```sql
CREATE TABLE accurate_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,           -- e.g., 'customer/list', 'item/list'
  cabang_id TEXT,                   -- Database ID dari Accurate
  data TEXT NOT NULL,               -- JSON string dari response API
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Contoh Data:**
| id | endpoint | cabang_id | data | created_at | updated_at |
|----|----------|-----------|------|------------|------------|
| 1 | customer/list | 1869410 | {"s":true,"d":[...]} | 2024-01-01 10:00:00 | 2024-01-01 10:00:00 |

### 2. api_logs
Menyimpan log API calls untuk monitoring

```sql
CREATE TABLE api_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  status INTEGER,                   -- HTTP status code
  response_time INTEGER,            -- Response time in ms
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Contoh Data:**
| id | endpoint | status | response_time | created_at |
|----|----------|--------|---------------|------------|
| 1 | customer/list | 200 | 1250 | 2024-01-01 10:00:00 |

## Query Examples

### Get Latest Cache for Endpoint
```sql
SELECT * FROM accurate_data 
WHERE endpoint = 'customer/list' 
  AND cabang_id = '1869410'
ORDER BY updated_at DESC 
LIMIT 1;
```

### Get All Cached Endpoints
```sql
SELECT endpoint, cabang_id, updated_at 
FROM accurate_data 
ORDER BY updated_at DESC;
```

### Check API Performance
```sql
SELECT 
  endpoint,
  COUNT(*) as total_calls,
  AVG(response_time) as avg_response_time,
  MAX(response_time) as max_response_time
FROM api_logs
GROUP BY endpoint;
```

### Clean Old Cache (older than 7 days)
```sql
DELETE FROM accurate_data 
WHERE updated_at < datetime('now', '-7 days');
```

## Future Enhancements

Untuk Phase selanjutnya, bisa ditambahkan:

### Table: sync_schedule
```sql
CREATE TABLE sync_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  cabang_id TEXT NOT NULL,
  schedule_cron TEXT,               -- e.g., '0 */6 * * *'
  last_sync DATETIME,
  next_sync DATETIME,
  status TEXT,                      -- 'active', 'paused', 'error'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table: export_history
```sql
CREATE TABLE export_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  cabang_id TEXT,
  file_name TEXT,
  row_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Maintenance

### Backup Database
```bash
# Windows
copy database\accurate.db database\accurate_backup.db

# Linux/Mac
cp database/accurate.db database/accurate_backup.db
```

### View Database Size
```sql
SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size();
```

### Optimize Database
```sql
VACUUM;
ANALYZE;
```
