# Create clean .env file from example
$envContent = @"
# Accurate Online API Credentials (Legacy - for single branch)
ACCURATE_APP_KEY=your_app_key_here
ACCURATE_SIGNATURE_SECRET=your_signature_secret_here
ACCURATE_CLIENT_ID=your_client_id_token_here

# SRP API Credentials (SNJ Merch)
SRP_APP_KEY=your_srp_app_key_here
SRP_APP_TOKEN=your_srp_app_token_here

# SNJ Merch Database (PostgreSQL)
# Use accurate_130 server or localhost
SRP_DATABASE_URL=postgresql://postgres:postgres@accurate_130:5432/srp_db

# Server Config
PORT=3000
NODE_ENV=development

# Database - PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/accurate_db
"@

# Write to .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline
Write-Host "Clean .env file created successfully!"
Write-Host "Please update the credentials in .env file"
