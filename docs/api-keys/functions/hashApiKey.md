[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / hashApiKey

# Function: hashApiKey()

> **hashApiKey**(`key`): `string`

Defined in: src/lib/api-keys.ts:198

Computes a SHA-256 hash of an API key.

## Parameters

### key

`string`

The API key to hash

## Returns

`string`

The hexadecimal SHA-256 hash of the key

## Remarks

This hash is stored in the database instead of the raw key for security.
When validating a key, the provided key is hashed and compared to the stored hash.
