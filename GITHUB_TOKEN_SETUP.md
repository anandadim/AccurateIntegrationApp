# GitHub Personal Access Token Setup

## Error 403 - Authentication Required

GitHub tidak lagi menerima password untuk HTTPS. Anda perlu Personal Access Token (PAT).

## Quick Fix - Generate Token

### Step 1: Generate Token

1. **Buka:** https://github.com/settings/tokens
2. **Klik:** "Generate new token" → "Generate new token (classic)"
3. **Isi form:**
   - **Note:** `Accurate API Integration`
   - **Expiration:** `90 days` (atau sesuai kebutuhan)
   - **Select scopes:** Centang **`repo`** (full control of private repositories)
4. **Klik:** "Generate token"
5. **COPY TOKEN** - Token hanya muncul sekali! Simpan di tempat aman.

Token akan terlihat seperti: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2: Update Remote URL dengan Token

```bash
# Remove existing remote
git remote remove origin

# Add remote dengan token
git remote add origin https://ghp_YOUR_TOKEN_HERE@github.com/anandadim/AccurateIntegrationApp.git

# Verify
git remote -v
```

**Contoh:**
```bash
git remote remove origin
git remote add origin https://ghp_abc123xyz789@github.com/anandadim/AccurateIntegrationApp.git
```

### Step 3: Push

```bash
git push -u origin main
```

## Alternative: Use GitHub CLI (Easier)

### Install GitHub CLI

```powershell
# Using winget
winget install GitHub.cli

# Or download from: https://cli.github.com/
```

### Login & Push

```bash
# Login (akan buka browser untuk auth)
gh auth login

# Select:
# - GitHub.com
# - HTTPS
# - Login with a web browser

# Push
git push -u origin main
```

## Alternative: Use SSH (Most Secure)

### Step 1: Generate SSH Key

```bash
# Generate key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Press Enter untuk default location
# Set passphrase (optional)
```

### Step 2: Add SSH Key to GitHub

```bash
# Copy public key
cat ~/.ssh/id_ed25519.pub
# Or on Windows:
type %USERPROFILE%\.ssh\id_ed25519.pub
```

1. Copy output
2. Buka https://github.com/settings/keys
3. Klik "New SSH key"
4. Paste key
5. Klik "Add SSH key"

### Step 3: Change Remote to SSH

```bash
# Remove HTTPS remote
git remote remove origin

# Add SSH remote
git remote add origin git@github.com:anandadim/AccurateIntegrationApp.git

# Push
git push -u origin main
```

## Troubleshooting

### Token Expired?

Generate new token dan update remote:
```bash
git remote set-url origin https://NEW_TOKEN@github.com/anandadim/AccurateIntegrationApp.git
```

### Still 403?

1. **Check repository exists:** https://github.com/anandadim/AccurateIntegrationApp
2. **Check you have access** (owner or collaborator)
3. **Check token has `repo` scope**
4. **Try GitHub CLI** (easiest option)

### Permission Denied (SSH)?

```bash
# Test SSH connection
ssh -T git@github.com

# Should see: "Hi USERNAME! You've successfully authenticated..."
```

## Recommended: GitHub CLI

Paling mudah dan aman:

```bash
# Install
winget install GitHub.cli

# Login
gh auth login

# Push
git push -u origin main
```

---

**Choose one method above and try again!**
