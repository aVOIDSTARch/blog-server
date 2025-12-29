[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / api-keys

# api-keys

## Description

API Key management module for the Blog Server API.

This module provides comprehensive API key functionality including:
- Key generation with cryptographically secure random values
- Key validation and authentication
- Scope-based authorization
- Site-level access control
- Usage tracking and statistics
- IP and origin restrictions

## Key Types
- **user** (`sk_*`): User-scoped keys for individual user access
- **site** (`ss_*`): Site-scoped keys for specific site access
- **admin** (`sa_*`): Admin keys with full system access

## Key Format
Keys follow the format: `{type}_{env}_{random}`
- Example: `sk_live_abc123def456...`
- Prefix stored in DB: `sk_live_XXXXXXXX` (first 8 chars)

## Example

```typescript
import { createApiKey, validateApiKey, hasScope } from './api-keys';

// Create a new API key
const { apiKey, id } = await createApiKey(prisma, {
  name: 'My API Key',
  keyType: 'user',
  userId: 'user-uuid',
  scopes: ['read', 'write']
});

// Validate and check scope
const validated = await validateApiKey(prisma, apiKey.key);
if (validated && hasScope(validated, 'write')) {
  // Authorized for write operations
}
```

## Interfaces

- [CreateApiKeyOptions](interfaces/CreateApiKeyOptions.md)
- [GeneratedApiKey](interfaces/GeneratedApiKey.md)
- [ValidatedApiKey](interfaces/ValidatedApiKey.md)

## Functions

- [createApiKey](functions/createApiKey.md)
- [generateApiKey](functions/generateApiKey.md)
- [getKeyUsageStats](functions/getKeyUsageStats.md)
- [grantSiteAccess](functions/grantSiteAccess.md)
- [hasAccessToSite](functions/hasAccessToSite.md)
- [hashApiKey](functions/hashApiKey.md)
- [hasScope](functions/hasScope.md)
- [isIpAllowed](functions/isIpAllowed.md)
- [isOriginAllowed](functions/isOriginAllowed.md)
- [listUserApiKeys](functions/listUserApiKeys.md)
- [recordUsage](functions/recordUsage.md)
- [revokeApiKey](functions/revokeApiKey.md)
- [revokeSiteAccess](functions/revokeSiteAccess.md)
- [validateApiKey](functions/validateApiKey.md)
