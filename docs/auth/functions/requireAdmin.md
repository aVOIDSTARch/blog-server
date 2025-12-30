[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [auth](../README.md) / requireAdmin

# Function: requireAdmin()

> **requireAdmin**(`req`, `res`, `next`): `void`

Defined in: [api/middleware/auth.ts:297](https://github.com/aVOIDSTARch/blog-server/blob/ac4118d365cfaabd1d50fd512dcafabf9b0d3099/blog-server/api/middleware/auth.ts#L297)

Middleware to require admin API key type.

Rejects with 403 if the API key is not an admin key.

## Parameters

### req

`Request`

Express request object

### res

`Response`

Express response object

### next

`NextFunction`

Express next function

## Returns

`void`

## Example

```typescript
router.delete('/users/:id', requireAdmin, deleteUser);
```
