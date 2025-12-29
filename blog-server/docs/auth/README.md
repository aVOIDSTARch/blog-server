[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / auth

# auth

## Description

Authentication and authorization middleware for the Blog Server API.

This module provides Express middleware for:
- API key authentication
- Scope-based authorization
- Site-level access control
- Admin-only routes
- Usage tracking

## Usage

```typescript
import { authenticateApiKey, requireScope, requireSiteAccess, requireAdmin } from './middleware/auth';

// Apply authentication to all API routes
app.use('/api', authenticateApiKey(prisma));

// Require specific scopes
router.post('/resource', requireScope('write'), handler);

// Require site access
router.get('/sites/:siteId/posts', requireSiteAccess('read'), handler);

// Admin only
router.delete('/users/:id', requireAdmin, handler);
```

## Functions

- [authenticateApiKey](functions/authenticateApiKey.md)
- [requireAdmin](functions/requireAdmin.md)
- [requireScope](functions/requireScope.md)
- [requireSiteAccess](functions/requireSiteAccess.md)
