# Quick Guide: Push to GitHub

## ⚠️ Error 403 - Need Personal Access Token

GitHub tidak menerima password lagi. Anda perlu Personal Access Token.

## 🚀 Quick Steps (5 menit)

### Step 1: Generate Token (2 menit)

1. **Buka browser:** https://github.com/settings/tokens
2. **Klik:** "Generate new token" → "Generate new token (classic)"
3. **Isi:**
   - Note: `Accurate API Integration`
   - Expiration: `90 days`
   - **Centang:** `repo` (full control)
4. **Klik:** "Generate token"
5. **COPY token** (dimulai dengan `ghp_...`)

### Step 2: Run Script (1 menit)

```powershell
# Run script
.\setup-github-push.ps1

# Paste token saat diminta
# Script akan otomatis push ke GitHub
```

### Step 3: Verify

Buka: https://github.com/anandadim/AccurateIntegrationApp

## 📝 Manual Method (Alternative)

Jika script tidak work:

```bash
# 1. Remove old remote
git remote remove origin

# 2. Add remote dengan token (ganti YOUR_TOKEN)
git remote add origin https://YOUR_TOKEN@github.com/anandadim/AccurateIntegrationApp.git

# 3. Push
git push -u origin main
```

**Contoh:**
```bash
git remote add origin https://ghp_abc123xyz789@github.com/anandadim/AccurateIntegrationApp.git
git push -u origin main
```

## ✅ Success Indicators

Jika berhasil, Anda akan melihat:
```
Enumerating objects: 54, done.
Counting objects: 100% (54/54), done.
...
To https://github.com/anandadim/AccurateIntegrationApp.git
 * [new branch]      main -> main
Branch 'main' set up to track remote branch 'main' from 'origin'.
```

## 🆘 Troubleshooting

### Still 403?
- Token salah atau expired
- Token tidak punya scope `repo`
- Repository tidak exist atau tidak punya akses

### Token Expired?
Generate token baru dan update:
```bash
git remote set-url origin https://NEW_TOKEN@github.com/anandadim/AccurateIntegrationApp.git
git push
```

### Need Help?
See detailed guide: [GITHUB_TOKEN_SETUP.md](GITHUB_TOKEN_SETUP.md)

---

**Ready?** Generate token dan run `.\setup-github-push.ps1`
