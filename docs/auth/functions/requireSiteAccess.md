[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [auth](../README.md) / requireSiteAccess

# Function: requireSiteAccess()

> **requireSiteAccess**(`requiredScope`): (`req`, `res`, `next`) => `Promise`\<`void`\>

Defined in: [api/middleware/auth.ts:243](https://github.com/aVOIDSTARch/blog-server/blob/ac4118d365cfaabd1d50fd512dcafabf9b0d3099/blog-server/api/middleware/auth.ts#L243)

Creates middleware to require access to a specific site.

Extracts site ID from `req.params.siteId` or `req.body.site_id`.
Rejects with 403 if the API key lacks access to the site.

## Parameters

### requiredScope

`api_key_scope`

The scope level required for access

## Returns

Express middleware function

> (`req`, `res`, `next`): `Promise`\<`void`\>

### Parameters

#### req

`Request`

#### res

`Response`

#### next

`NextFunction`

### Returns

`Promise`\<`void`\>

## Example

```typescript
router.get('/sites/:siteId/posts', requireSiteAccess('read'), listPosts);
router.post('/sites/:siteId/posts', requireSiteAccess('write'), createPost);
```
