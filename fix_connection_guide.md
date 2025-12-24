# Fix SNJ PostgreSQL Connection Timeout

## Current Issue
- Error: `Connection terminated due to connection timeout` 
- Hostname `accurate_130` not reachable (ENOTFOUND)
- Ping to `192.168.1.130` times out

## Solutions (Try in Order)

### Option 1: Use IP Address Directly
Update your `.env` file:
```bash
# Replace hostname with IP
SRP_DATABASE_URL=postgresql://postgres:admin@192.168.1.130:5432/srp_db?connect_timeout=10
```

### Option 2: Check Network Connectivity
1. Verify server `accurate_130` is running and accessible
2. Check firewall settings on server
3. Ensure PostgreSQL accepts remote connections:
   ```sql
   -- In postgresql.conf
   listen_addresses = '*'
   
   -- In pg_hba.conf
   host all all 0.0.0.0/0 md5
   ```

### Option 3: Use Local Database (Temporary)
```bash
# Revert to local PostgreSQL
SRP_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/srp_db
```

### Option 4: Add Connection Pool Settings
Already updated in `backend/config/database.js`:
- connectionTimeoutMillis: 10000 (increased from 2000)
- query_timeout: 30000
- statement_timeout: 30000
- idleTimeoutMillis: 60000

## Testing Connection
```bash
# Test with psql
psql "postgresql://postgres:admin@192.168.1.130:5432/srp_db"

# Or with node
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:admin@192.168.1.130:5432/srp_db' });
pool.connect().then(() => console.log('Connected!')).catch(console.error);
"
```

## Next Steps
1. Update `.env` with correct server details
2. Restart backend server: `npm run dev`
3. Test SNJ sync again
4. Monitor connection logs in console
