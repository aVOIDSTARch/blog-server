[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / validateApiKey

# Function: validateApiKey()

> **validateApiKey**(`prisma`, `key`): `Promise`\<[`ValidatedApiKey`](../interfaces/ValidatedApiKey.md) \| `null`\>

Defined in: src/lib/api-keys.ts:305

Validates an API key and returns its details if valid.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### key

`string`

The full API key string to validate

## Returns

`Promise`\<[`ValidatedApiKey`](../interfaces/ValidatedApiKey.md) \| `null`\>

The validated API key details, or null if invalid/expired/revoked

## Remarks

A key is considered invalid if:
- The hash doesn't match any stored key
- The key is not active
- The key has been revoked
- The key has expired

## Example

```typescript
const validated = await validateApiKey(prisma, 'sk_live_abc123...');
if (validated) {
  console.log('Key belongs to:', validated.userId);
}
```
