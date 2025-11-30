# Reload Branches Feature

## Problem
Sebelumnya, kalau update `branches.json` saat backend jalan, perubahan tidak akan ter-load karena config di-cache di memory. Harus restart backend untuk load config baru.

## Solution
Tambahkan fitur reload branches tanpa restart backend.

---

## Backend Changes

### 1. Service Layer (`backend/services/accurateService.js`)

**Added:**
- `forceReload` parameter di `loadBranchesConfig()`
- `clearBranchesCache()` function
- `reloadBranches()` method di `accurateService`

**Usage:**
```javascript
// Normal load (with cache)
const branches = accurateService.getBranches();

// Force reload (clear cache)
const branches = accurateService.reloadBranches();
```

### 2. Controller Layer (`backend/controllers/accurateController.js`)

**Added:**
- Query parameter `reload` di `getBranches()`
- New endpoint handler `reloadBranches()`

### 3. Routes (`backend/routes/api.js`)

**New Endpoint:**
```
POST /api/branches/reload
```

**Response:**
```json
{
  "success": true,
  "message": "Reloaded 14 branches",
  "data": [...]
}
```

---

## Frontend Changes

### 1. API Service (`frontend/src/services/apiService.js`)

**Added:**
```javascript
// Get branches with optional reload
apiService.getBranches(reload = false)

// Force reload branches
apiService.reloadBranches()
```

### 2. SyncManager Component (`frontend/src/components/SyncManager.vue`)

**Added:**
- 🔄 Reload button next to branch selector
- Shows branch count: "14 cabang tersedia"
- Loading state while reloading

**UI:**
```
[Dropdown: Pilih Cabang ▼] [🔄 Reload]
14 cabang tersedia
```

---

## How to Use

### Scenario: Update branches.json

1. **Edit** `backend/config/branches.json`
   - Add new branch
   - Update credentials
   - Change active status

2. **Reload** (2 options):

   **Option A: Via Frontend (Recommended)**
   - Open Sync Manager
   - Click "🔄 Reload" button
   - Page will refresh with new branches

   **Option B: Via API**
   ```bash
   curl -X POST http://localhost:3000/api/branches/reload
   ```

3. **Verify**
   - Check dropdown shows updated branches
   - Check count: "X cabang tersedia"

### No Restart Needed!
Backend tetap jalan, config di-reload dari file.

---

## Technical Details

### Cache Mechanism

**Before:**
```javascript
let branchesConfig = null;

const loadBranchesConfig = () => {
  if (!branchesConfig) {  // Load once, cache forever
    branchesConfig = JSON.parse(fs.readFileSync(...));
  }
  return branchesConfig;
};
```

**After:**
```javascript
let branchesConfig = null;

const loadBranchesConfig = (forceReload = false) => {
  if (!branchesConfig || forceReload) {  // Can force reload
    branchesConfig = JSON.parse(fs.readFileSync(...));
    console.log(`✅ Loaded ${branchesConfig.branches.length} branches`);
  }
  return branchesConfig;
};

const clearBranchesCache = () => {
  branchesConfig = null;
  console.log('🔄 Branches cache cleared');
};
```

### API Endpoints

**GET /api/branches**
- Default: Use cache
- With `?reload=true`: Force reload

**POST /api/branches/reload**
- Clear cache
- Reload from file
- Return updated branches

---

## Benefits

✅ No restart needed after config changes
✅ Instant update via UI button
✅ Backward compatible (cache still works)
✅ Logging for debugging
✅ User-friendly (shows branch count)

---

## Testing

### Test 1: Add New Branch
1. Add branch-15 to branches.json
2. Click reload button
3. Verify branch-15 appears in dropdown

### Test 2: Deactivate Branch
1. Set `"active": false` for a branch
2. Click reload button
3. Verify branch disappears from dropdown

### Test 3: Update Credentials
1. Update clientId for a branch
2. Click reload button
3. Try sync with that branch
4. Verify uses new credentials

---

## Troubleshooting

### Reload button not working?
- Check backend is running
- Check browser console for errors
- Try manual API call: `curl -X POST http://localhost:3000/api/branches/reload`

### Changes not reflected?
- Check branches.json syntax (valid JSON)
- Check `"active": true` for branches you want to show
- Check backend logs for errors

### Page doesn't refresh?
- Currently uses `window.location.reload()`
- Alternative: Emit event to parent component to update branches prop

---

## Future Improvements

- [ ] Auto-reload on file change (watch branches.json)
- [ ] Reload without page refresh (emit to parent)
- [ ] Validate branches.json before reload
- [ ] Show diff (what changed)
- [ ] Reload other configs (database, etc)

---

## Files Changed

**Backend:**
- `backend/services/accurateService.js`
- `backend/controllers/accurateController.js`
- `backend/routes/api.js`

**Frontend:**
- `frontend/src/services/apiService.js`
- `frontend/src/components/SyncManager.vue`

**Documentation:**
- `RELOAD_BRANCHES_GUIDE.md` (this file)
