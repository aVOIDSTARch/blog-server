[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / hasAccessToSite

# Function: hasAccessToSite()

> **hasAccessToSite**(`prisma`, `apiKey`, `siteId`, `requiredScope`): `Promise`\<`boolean`\>

Defined in: src/lib/api-keys.ts:389

Checks if an API key has access to a specific site with the required scope.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### apiKey

[`ValidatedApiKey`](../interfaces/ValidatedApiKey.md)

The validated API key to check

### siteId

`string`

The site ID to check access for

### requiredScope

`api_key_scope`

The scope required for the operation

## Returns

`Promise`\<`boolean`\>

True if the key has access to the site with the required scope

## Remarks

Access is determined by:
- Admin keys have access to all sites
- Site keys only have access to their specific site
- User keys have access to owned sites, membership sites, and explicitly granted sites

## Example

```typescript
const canWrite = await hasAccessToSite(prisma, apiKey, siteId, 'write');
if (!canWrite) {
  throw new Error('Access denied');
}
```
