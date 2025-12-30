[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / generateApiKey

# Function: generateApiKey()

> **generateApiKey**(`keyType`): [`GeneratedApiKey`](../interfaces/GeneratedApiKey.md)

Defined in: src/lib/api-keys.ts:178

Generates a new API key with its prefix and hash.

## Parameters

### keyType

`api_key_type`

The type of API key to generate (user, site, or admin)

## Returns

[`GeneratedApiKey`](../interfaces/GeneratedApiKey.md)

An object containing the full key, prefix, and hash

## Example

```typescript
const { key, prefix, hash } = generateApiKey('user');
// key: "sk_live_abc123..."
// prefix: "sk_live_abc12345"
// hash: "sha256hash..."
```
