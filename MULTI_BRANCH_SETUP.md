# Multi-Branch Setup Guide

## Overview

Untuk handle 16 cabang dengan credentials berbeda, ada beberapa approach yang bisa digunakan.

## Current Implementation

Saat ini menggunakan single credentials dari `.env`:
```
ACCURATE_CLIENT_ID=...
ACCURATE_SIGNATURE_SECRET=...
ACCURATE_APP_KEY=...
```

## Multi-Branch Options

### Option 1: Config File (Recommended)

File `backend/config/branches.json`:
```json
{
  "branches": [
    {
      "id": "branch-1",
      "name": "Cabang Semarang",
      "dbId": "1869410",
      "credentials": {
        "appKey": "...",
        "signatureSecret": "...",
        "clientId": "..."
      },
      "active": true
    },
    {
      "id": "branch-2",
      "name": "Cabang Jakarta",
      "dbId": "1234567",
      "credentials": {
        "appKey": "...",
        "signatureSecret": "...",
        "clientId": "..."
      },
      "active": true
    }
  ]
}
```

**Pros:**
- Centralized management
- Easy to add/remove branches
- Can be edited without restart
- Can be managed via UI later

**Cons:**
- Need to protect file (add to .gitignore)
- All credentials in one place

### Option 2: Database Storage

Store credentials in SQLite/PostgreSQL:

```sql
CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  db_id TEXT NOT NULL,
  app_key TEXT NOT NULL,
  signature_secret TEXT NOT NULL,
  client_id TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Pros:**
- More secure
- Can add UI for management
- Audit trail
- Encryption possible

**Cons:**
- More complex implementation
- Need migration

### Option 3: Environment Variables per Branch

```
# .env
BRANCH_1_CLIENT_ID=...
BRANCH_1_SECRET=...
BRANCH_2_CLIENT_ID=...
BRANCH_2_SECRET=...
```

**Pros:**
- Simple
- Follows 12-factor app

**Cons:**
- Hard to manage 16 branches
- Need restart on changes
- .env file becomes huge

## Recommended Implementation

**Phase 1 (Current):** Single branch with .env
**Phase 2 (Next):** Config file (`branches.json`)
**Phase 3 (Future):** Database storage with UI management

## How to Add New Branch

### Using Config File:

1. Edit `backend/config/branches.json`
2. Add new branch object:
```json
{
  "id": "branch-3",
  "name": "Cabang Surabaya",
  "dbId": "your_db_id",
  "credentials": {
    "appKey": "your_app_key",
    "signatureSecret": "your_secret",
    "clientId": "your_token"
  },
  "active": true
}
```
3. Restart backend (or implement hot-reload)
4. Branch akan muncul di frontend dropdown

## Frontend Changes Needed

Update `App.vue` untuk show branch selector:

```vue
<select v-model="selectedBranch">
  <option value="">-- Pilih Cabang --</option>
  <option v-for="branch in branches" :key="branch.id" :value="branch.id">
    {{ branch.name }}
  </option>
</select>
```

## Backend Changes Needed

Update services to accept `branchId`:

```javascript
// accurateService.js
async fetchData(endpoint, dbId, branchId) {
  const client = createApiClient(dbId, branchId);
  // ...
}
```

## Security Considerations

1. **Never commit `branches.json`** - Add to `.gitignore`
2. **Encrypt sensitive data** - Consider encryption at rest
3. **Use environment-specific configs** - Different for dev/prod
4. **Rotate credentials regularly** - Update tokens periodically
5. **Audit access** - Log which branch is accessed when

## Migration Path

### From Single to Multi-Branch:

1. Create `branches.json` with current credentials as branch-1
2. Update service to read from config
3. Add branch selector to frontend
4. Test with 1 branch
5. Add remaining 15 branches one by one
6. Test each branch
7. Remove .env credentials (keep as fallback)

## Testing

Test each branch:
```bash
# Test branch-1
curl -X GET "http://localhost:3000/api/data/sales-invoice/list?branchId=branch-1&dbId=1869410"

# Test branch-2
curl -X GET "http://localhost:3000/api/data/sales-invoice/list?branchId=branch-2&dbId=1234567"
```

## Future Enhancements

- [ ] UI for branch management
- [ ] Credential encryption
- [ ] Branch-specific settings (timezone, currency, etc.)
- [ ] Branch performance monitoring
- [ ] Bulk operations across branches
- [ ] Branch access control (user permissions)

---

**Note:** File `branches.json` sudah di-create dengan 1 cabang sebagai contoh. Tinggal tambahkan 15 cabang lainnya dengan credentials masing-masing.
