[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / hasScope

# Function: hasScope()

> **hasScope**(`apiKey`, `requiredScope`): `boolean`

Defined in: src/lib/api-keys.ts:355

Checks if an API key has a specific permission scope.

## Parameters

### apiKey

[`ValidatedApiKey`](../interfaces/ValidatedApiKey.md)

The validated API key to check

### requiredScope

`api_key_scope`

The scope required for the operation

## Returns

`boolean`

True if the key has the required scope

## Remarks

Admin scope (`admin`) implies all other scopes.

## Example

```typescript
if (hasScope(apiKey, 'write')) {
  // User can write
}
```
