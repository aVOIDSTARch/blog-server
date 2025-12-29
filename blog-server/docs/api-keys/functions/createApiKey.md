[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / createApiKey

# Function: createApiKey()

> **createApiKey**(`prisma`, `options`): `Promise`\<\{ `apiKey`: [`GeneratedApiKey`](../interfaces/GeneratedApiKey.md); `id`: `string`; \}\>

Defined in: src/lib/api-keys.ts:224

Creates a new API key in the database.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### options

[`CreateApiKeyOptions`](../interfaces/CreateApiKeyOptions.md)

Configuration options for the new API key

## Returns

`Promise`\<\{ `apiKey`: [`GeneratedApiKey`](../interfaces/GeneratedApiKey.md); `id`: `string`; \}\>

The generated API key details and its database ID

## Throws

If validation fails for the key type and ownership constraints

## Example

```typescript
const { apiKey, id } = await createApiKey(prisma, {
  name: 'Production API Key',
  keyType: 'user',
  userId: 'user-uuid',
  scopes: ['read', 'write'],
  rateLimitPerMinute: 100
});

console.log('Save this key:', apiKey.key);
```
