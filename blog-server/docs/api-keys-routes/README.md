[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / api-keys-routes

# api-keys-routes

## Description

API Key management routes for the Blog Server API.

This module provides RESTful endpoints for managing API keys:
- List API keys
- View API key details
- Create new API keys
- Update API key settings
- Revoke API keys
- View usage statistics
- Manage site access permissions

## Security

- Full API keys are only shown once upon creation
- Keys are stored as SHA-256 hashes in the database
- Key type and scopes cannot be changed after creation

## Key Types

- **user**: User-scoped keys for individual access
- **site**: Site-scoped keys for specific site operations
- **admin**: Full system access (admin-only creation)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/api-keys | List API keys |
| GET | /api/api-keys/:keyId | Get key details |
| POST | /api/api-keys | Create new API key |
| PATCH | /api/api-keys/:keyId | Update key settings |
| POST | /api/api-keys/:keyId/revoke | Revoke an API key |
| GET | /api/api-keys/:keyId/usage | Get usage statistics |
| POST | /api/api-keys/:keyId/site-access | Grant site access |
| DELETE | /api/api-keys/:keyId/site-access/:siteId | Revoke site access |

## Variables

- [default](variables/default.md)
