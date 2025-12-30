[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [auth](../README.md) / authenticateApiKey

# Function: authenticateApiKey()

> **authenticateApiKey**(`prisma`): (`req`, `res`, `next`) => `Promise`\<`void`\>

Defined in: [api/middleware/auth.ts:118](https://github.com/aVOIDSTARch/blog-server/blob/ac4118d365cfaabd1d50fd512dcafabf9b0d3099/blog-server/api/middleware/auth.ts#L118)

Creates middleware to authenticate requests using API keys.

This middleware:
1. Extracts the API key from headers
2. Validates the key against the database
3. Checks IP and origin restrictions
4. Attaches the validated key to `req.apiKey`
5. Records usage after the response is sent

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

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
app.use('/api', authenticateApiKey(prisma));
```
