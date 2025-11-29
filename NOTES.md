# Catatan Penting

## ⚠️ Sebelum Mulai

### 1. Credentials di .env
File `.env` sudah berisi credentials Accurate API Anda. **JANGAN share atau commit file ini ke Git!**

Sudah di-protect dengan `.gitignore`, tapi tetap hati-hati.

### 2. Token Expiration
Token Accurate Online API punya masa berlaku. Kalau dapat error authentication:
- Cek apakah token masih valid
- Generate token baru dari Accurate Online dashboard
- Update di file `.env`

### 3. Database ID (dbId)
Setiap cabang punya Database ID unik. Untuk mendapatkannya:
- Call endpoint `/api/databases`
- Atau lihat di Accurate Online dashboard

## 🎯 Testing Strategy

### Langkah Testing yang Disarankan:

1. **Test Backend Health**
   ```
   GET http://localhost:3000/
   ```
   Expected: `{ status: 'ok', message: '...' }`

2. **Test Get Databases**
   ```
   GET http://localhost:3000/api/databases
   ```
   Expected: List cabang dengan ID dan nama

3. **Test Get Data (pilih 1 endpoint dulu)**
   ```
   GET http://localhost:3000/api/data/customer/list?dbId=YOUR_DB_ID
   ```
   Expected: Data customer dari Accurate

4. **Verify Cache**
   - Cek folder `database/`
   - File `accurate.db` harus ada
   - Bisa buka dengan DB Browser for SQLite

5. **Test Frontend**
   - Buka http://localhost:5173
   - Test semua flow dari UI

## 🔍 Debugging Tips

### Backend Error
```bash
# Lihat log di terminal backend
# Error biasanya muncul di console
```

### Frontend Error
```bash
# Buka Developer Tools (F12) di browser
# Lihat tab Console untuk error
# Lihat tab Network untuk API calls
```

### Database Error
```bash
# Cek apakah folder database/ ada
# Cek permission write di folder
# Cek apakah sqlite3 terinstall
```

## 📊 Monitoring

### Check API Response Time
Lihat table `api_logs` di SQLite untuk monitoring performance:
```sql
SELECT endpoint, AVG(response_time) as avg_ms 
FROM api_logs 
GROUP BY endpoint;
```

### Check Cache Size
```sql
SELECT COUNT(*) as total_records FROM accurate_data;
```

### Check Last Sync
```sql
SELECT endpoint, cabang_id, updated_at 
FROM accurate_data 
ORDER BY updated_at DESC;
```

## 🚨 Common Issues

### Issue: "Cannot find module 'fastify'"
**Solution:** Run `npm install` di root folder

### Issue: "Cannot find module 'vue'"
**Solution:** Run `npm install` di folder `frontend/`

### Issue: "Port 3000 already in use"
**Solution:** 
- Stop aplikasi lain yang pakai port 3000
- Atau ubah PORT di `.env`

### Issue: "Failed to fetch databases"
**Solution:**
- Cek credentials di `.env`
- Cek koneksi internet
- Cek apakah token masih valid

### Issue: "CORS error"
**Solution:** Sudah di-handle di backend, tapi pastikan:
- Backend running di port 3000
- Frontend running di port 5173
- Proxy config di `vite.config.js` benar

## 💾 Backup Strategy

### Backup Database
```bash
# Manual backup
copy database\accurate.db database\accurate_backup_YYYYMMDD.db
```

### Backup .env
Simpan copy `.env` di tempat aman (JANGAN di Git!)

## 🔄 Update Credentials

Kalau perlu update credentials:
1. Edit file `.env`
2. Restart backend server
3. Test ulang

## 📈 Performance Notes

### SQLite Limits
- Max database size: 281 TB (lebih dari cukup)
- Max concurrent readers: Unlimited
- Max concurrent writers: 1 (tapi cukup untuk use case ini)

### When to Migrate to PostgreSQL
Pertimbangkan migrate kalau:
- Concurrent writes > 100/second
- Database size > 1 GB
- Need advanced features (full-text search, etc.)

## 🎓 Learning Resources

### Fastify
- Docs: https://fastify.dev/

### Vue.js
- Docs: https://vuejs.org/

### Accurate Online API
- Docs: https://accurate.id/api-documentation/

### SQLite
- Docs: https://www.sqlite.org/docs.html

## ✅ Checklist Sebelum Production

- [ ] Test semua endpoint dengan data real
- [ ] Setup proper error handling
- [ ] Implement token refresh logic
- [ ] Add rate limiting
- [ ] Setup logging yang proper
- [ ] Backup strategy
- [ ] Monitor performance
- [ ] Security audit
- [ ] Documentation update

---

**Last Updated:** 2024
**Phase:** 1 (GET Data Only)
