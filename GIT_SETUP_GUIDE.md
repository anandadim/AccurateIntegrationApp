# Git & GitHub Setup Guide

## ✅ Status: Git Initialized & First Commit Done!

Commit pertama sudah berhasil dibuat dengan 50 files.

## 📋 Next Steps: Push to GitHub

### Step 1: Create GitHub Repository

1. Buka https://github.com
2. Login ke akun Anda
3. Klik tombol **"+"** di kanan atas → **"New repository"**
4. Isi form:
   - **Repository name:** `accurate-api-integration` (atau nama lain)
   - **Description:** "Accurate Online API Integration with PostgreSQL"
   - **Visibility:** 
     - ✅ **Private** (Recommended - karena ada credentials)
     - ⚠️ Jangan pilih Public!
   - **Initialize:** 
     - ❌ JANGAN centang "Add a README file"
     - ❌ JANGAN centang "Add .gitignore"
     - ❌ JANGAN pilih license
5. Klik **"Create repository"**

### Step 2: Connect Local to GitHub

Setelah repository dibuat, GitHub akan menampilkan instruksi. Gunakan yang ini:

```bash
# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Verify remote
git remote -v

# Push to GitHub
git push -u origin main
```

**Contoh:**
```bash
git remote add origin https://github.com/johndoe/accurate-api-integration.git
git push -u origin main
```

### Step 3: Authenticate

Saat push pertama kali, GitHub akan minta authentication:

**Option A: Personal Access Token (Recommended)**
1. Buka https://github.com/settings/tokens
2. Klik **"Generate new token"** → **"Generate new token (classic)"**
3. Isi:
   - Note: "Accurate API Integration"
   - Expiration: 90 days (atau sesuai kebutuhan)
   - Scopes: Centang **"repo"** (full control)
4. Klik **"Generate token"**
5. **COPY TOKEN** (hanya muncul sekali!)
6. Saat git push minta password, paste token ini

**Option B: GitHub CLI**
```bash
# Install GitHub CLI
winget install GitHub.cli

# Login
gh auth login

# Push
git push -u origin main
```

### Step 4: Verify

Setelah push berhasil:
1. Buka repository di GitHub
2. Pastikan semua files sudah ter-upload
3. Check bahwa `.env` dan `branches.json` **TIDAK** ada (sudah di-gitignore)

## 🔐 Security Checklist

Sebelum push, pastikan:

- ✅ `.env` ada di `.gitignore`
- ✅ `backend/config/branches.json` ada di `.gitignore`
- ✅ `*.db` files di-ignore
- ✅ `node_modules/` di-ignore
- ✅ File `.env.example` dan `branches.example.json` sudah dibuat
- ✅ Repository di-set **Private**

## 📝 Git Commands Reference

### Daily Workflow

```bash
# Check status
git status

# Add changes
git add .

# Commit
git commit -m "Your commit message"

# Push to GitHub
git push

# Pull from GitHub
git pull
```

### Branch Management

```bash
# Create new branch
git checkout -b feature/new-feature

# Switch branch
git checkout main

# List branches
git branch

# Delete branch
git branch -d feature/old-feature
```

### Undo Changes

```bash
# Discard changes in working directory
git restore filename.js

# Unstage file
git restore --staged filename.js

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

## 🚨 Important Notes

### NEVER Commit These Files:
- `.env` - Contains credentials
- `backend/config/branches.json` - Contains API tokens
- `*.db` - Database files
- `node_modules/` - Dependencies

### If You Accidentally Committed Sensitive Files:

```bash
# Remove from Git but keep local file
git rm --cached .env
git rm --cached backend/config/branches.json

# Commit the removal
git commit -m "Remove sensitive files"

# Push
git push

# Then add to .gitignore if not already there
```

⚠️ **Warning:** Files yang sudah ter-push ke GitHub akan tetap ada di history! Jika ini terjadi:
1. Change all credentials immediately
2. Consider using `git filter-branch` or BFG Repo-Cleaner
3. Or create new repository

## 📚 Useful Git Commands

```bash
# View commit history
git log --oneline

# View changes
git diff

# View remote info
git remote -v

# Clone repository (for team members)
git clone https://github.com/USERNAME/REPO_NAME.git

# Update from remote
git fetch
git pull
```

## 👥 Collaboration

### For Team Members:

1. **Clone repository:**
```bash
git clone https://github.com/USERNAME/REPO_NAME.git
cd REPO_NAME
```

2. **Setup environment:**
```bash
# Copy example files
cp .env.example .env
cp backend/config/branches.example.json backend/config/branches.json

# Edit with actual credentials
# Install dependencies
npm install
cd frontend && npm install && cd ..
```

3. **Setup PostgreSQL** (see INSTALL_POSTGRESQL_WINDOWS.md)

4. **Run application:**
```bash
npm run dev
```

## 🔄 Keeping Repository Updated

```bash
# Before starting work
git pull

# After making changes
git add .
git commit -m "Description of changes"
git push
```

## 📊 Repository Structure

```
accurate-api-integration/
├── .git/                    # Git metadata (auto-created)
├── .gitignore              # Files to ignore
├── .env.example            # Environment template
├── backend/                # Backend code
├── frontend/               # Frontend code
├── *.md                    # Documentation
└── test-*.js              # Test scripts
```

## ✅ Verification Checklist

After pushing to GitHub:

- [ ] Repository is **Private**
- [ ] `.env` is NOT in repository
- [ ] `branches.json` is NOT in repository
- [ ] `.env.example` IS in repository
- [ ] `branches.example.json` IS in repository
- [ ] README.md is visible
- [ ] All documentation files are uploaded
- [ ] Code is properly organized

---

**Ready to push?** Follow Step 1-4 above!

**Need help?** Check GitHub documentation: https://docs.github.com/en/get-started
