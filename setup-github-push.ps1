# GitHub Push Setup Script
# Run this after generating Personal Access Token

Write-Host "=== GitHub Push Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "Error: Git not initialized!" -ForegroundColor Red
    exit 1
}

Write-Host "Repository: anandadim/AccurateIntegrationApp" -ForegroundColor Green
Write-Host ""

# Prompt for token
Write-Host "Please generate Personal Access Token first:" -ForegroundColor Yellow
Write-Host "1. Open: https://github.com/settings/tokens" -ForegroundColor White
Write-Host "2. Click: 'Generate new token (classic)'" -ForegroundColor White
Write-Host "3. Select scope: 'repo' (full control)" -ForegroundColor White
Write-Host "4. Click: 'Generate token'" -ForegroundColor White
Write-Host "5. Copy the token (starts with ghp_)" -ForegroundColor White
Write-Host ""

$token = Read-Host "Paste your Personal Access Token here"

if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "Error: Token cannot be empty!" -ForegroundColor Red
    exit 1
}

# Remove existing remote if exists
Write-Host ""
Write-Host "Removing existing remote..." -ForegroundColor Yellow
git remote remove origin 2>$null

# Add new remote with token
Write-Host "Adding remote with token..." -ForegroundColor Yellow
$remoteUrl = "https://$token@github.com/anandadim/AccurateIntegrationApp.git"
git remote add origin $remoteUrl

# Verify
Write-Host ""
Write-Host "Verifying remote..." -ForegroundColor Yellow
git remote -v

# Push
Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Success! Repository pushed to GitHub!" -ForegroundColor Green
    Write-Host "View at: https://github.com/anandadim/AccurateIntegrationApp" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Error: Push failed!" -ForegroundColor Red
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. Token is valid and has 'repo' scope" -ForegroundColor White
    Write-Host "2. Repository exists: https://github.com/anandadim/AccurateIntegrationApp" -ForegroundColor White
    Write-Host "3. You have write access to the repository" -ForegroundColor White
}
