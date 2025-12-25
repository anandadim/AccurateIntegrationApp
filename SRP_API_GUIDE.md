# SRP API Integration Guide

## Overview

This guide explains how to use the SRP API integration that has been added to your Accurate Integration App. The SRP API integration follows the same structure and patterns as the existing Accurate API integration.

## Files Created

1. **`backend/services/srpService.js`** - Main SRP API service with all the same functions as accurateService.js
2. **`backend/controllers/srpController.js`** - Controller for handling SRP API requests
3. **`backend/config/srp-branches.example.json`** - Example configuration file for SRP branches
4. **Updated `.env.example`** - Added SRP API credentials
5. **Updated `backend/routes/api.js`** - Added SRP API routes

## Configuration Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
# SRP API Credentials
SRP_APP_KEY=your_srp_app_key_here
SRP_SIGNATURE_SECRET=your_srp_signature_secret_here
SRP_CLIENT_ID=your_srp_client_id_token_here
```

### 2. Branch Configuration

Create `backend/config/srp-branches.json` based on the example:

```json
{
  "branches": [
    {
      "id": "srp-branch-1",
      "name": "SRP Cabang 1",
      "dbId": "YOUR_SRP_DB_ID",
      "baseUrl": "https://api.srp.com",
      "credentials": {
        "appKey": "YOUR_SRP_APP_KEY",
        "signatureSecret": "YOUR_SRP_SIGNATURE_SECRET",
        "clientId": "YOUR_SRP_CLIENT_ID_TOKEN"
      },
      "active": true
    }
  ]
}
```

## API Endpoints

All SRP API endpoints are prefixed with `/srp/`:

### Branch Management
- `GET /api/srp/branches` - Get all SRP branches
- `POST /api/srp/branches/reload` - Reload SRP branches config

### Database Operations
- `GET /api/srp/databases/:branchId` - Get databases for a branch

### Data Fetching
- `GET /api/srp/data/:endpoint/:dbId` - Fetch data from endpoint
- `GET /api/srp/detail/:endpoint/:id/:dbId` - Fetch detail by ID
- `GET /api/srp/list/:endpoint/:dbId` - Fetch list only
- `GET /api/srp/filter/:endpoint/:dbId` - Fetch data with filters
- `GET /api/srp/all-pages/:endpoint/:dbId` - Fetch all pages with filters
- `GET /api/srp/details/:endpoint/:dbId` - Fetch list with all details
- `POST /api/srp/stream/:endpoint/:dbId` - Fetch and stream insert

## Usage Examples

### Get SRP Branches
```javascript
const response = await fetch('/api/srp/branches');
const { data } = await response.json();
console.log(data); // Array of SRP branches
```

### Fetch SRP Data
```javascript
const response = await fetch('/api/srp/data/customer/list/DB_ID?branchId=srp-branch-1');
const { data } = await response.json();
console.log(data); // Customer data from SRP API
```

### Fetch with Filters
```javascript
const response = await fetch('/api/srp/filter/sales-invoice/list/DB_ID?branchId=srp-branch-1&filter.createdDate.op=BETWEEN&filter.createdDate.val=01/01/2024&filter.createdDate.val=31/12/2024');
const { data } = await response.json();
console.log(data); // Filtered sales invoice data
```

## Important Notes

1. **Base URL**: Update `DEFAULT_SRP_BASE_URL` in `srpService.js` to match your actual SRP API URL
2. **Authentication**: The service uses the same signature-based authentication as Accurate API
3. **Date Format**: Currently uses DD/MM/YYYY format - adjust if SRP API uses different format
4. **Endpoints**: The service assumes SRP API follows similar endpoint patterns as Accurate API
5. **Response Format**: Assumes SRP API returns similar response structure with `s` (success) and `d` (data) fields

## Customization Needed

1. **Update Base URL**: Change `https://api.srp.com` to your actual SRP API URL
2. **Date Format**: Adjust `formatDateForSrp()` function if SRP API uses different date format
3. **Authentication**: Modify `generateSrSignature()` if SRP API uses different authentication method
4. **Response Handling**: Update response parsing if SRP API returns different structure
5. **Endpoints**: Adjust endpoint URLs if SRP API uses different patterns

## Testing

To test the SRP API integration:

1. Set up your SRP API credentials in `.env`
2. Create `srp-branches.json` with your branch configurations
3. Start the server: `npm start`
4. Test with: `GET /api/srp/branches`

## Comparison with Accurate API

| Feature | Accurate API | SRP API (New) |
|---------|--------------|----------------|
| Base URL | `https://cday5l.pvt1.accurate.id/accurate/api` | `https://api.srp.com` (configurable) |
| Config File | `branches.json` | `srp-branches.json` |
| Env Prefix | `ACCURATE_` | `SRP_` |
| Route Prefix | `/api/` | `/api/srp/` |
| Service | `accurateService.js` | `srpService.js` |
| Controller | `accurateController.js` | `srpController.js` |

## Next Steps

1. Update the base URL to match your SRP API
2. Test the authentication method with your SRP API
3. Adjust date formatting if needed
4. Test with actual SRP API endpoints
5. Implement database models if you want to store SRP data
6. Add SRP-specific controllers for different data types if needed
