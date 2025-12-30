[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [auth](../README.md) / requireScope

# Function: requireScope()

> **requireScope**(...`requiredScopes`): (`req`, `res`, `next`) => `void`

Defined in: [api/middleware/auth.ts:200](https://github.com/aVOIDSTARch/blog-server/blob/ac4118d365cfaabd1d50fd512dcafabf9b0d3099/blog-server/api/middleware/auth.ts#L200)

Creates middleware to require specific permission scope(s).

The request is rejected with 403 if the API key lacks the required scope.

## Parameters

### requiredScopes

...`api_key_scope`[]

One or more scopes required (any one is sufficient)

## Returns

Express middleware function

> (`req`, `res`, `next`): `void`

### Parameters

#### req

`Request`

#### res

`Response`

#### next

`NextFunction`

### Returns

`void`

## Example

```typescript
// Require write scope
router.post('/posts', requireScope('write'), createPost);

// Require either delete or admin scope
router.delete('/posts/:id', requireScope('delete', 'admin'), deletePost);
```
