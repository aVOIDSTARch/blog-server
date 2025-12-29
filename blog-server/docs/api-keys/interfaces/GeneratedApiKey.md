[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / GeneratedApiKey

# Interface: GeneratedApiKey

Defined in: src/lib/api-keys.ts:72

Represents a newly generated API key with all components.

## Remarks

The full `key` value is only available at creation time and should be
securely transmitted to the user. Only the `prefix` and `hash` are stored.

## Properties

### hash

> **hash**: `string`

Defined in: src/lib/api-keys.ts:78

SHA-256 hash of the key (stored in DB for validation)

***

### key

> **key**: `string`

Defined in: src/lib/api-keys.ts:74

The full API key (only shown once at creation)

***

### prefix

> **prefix**: `string`

Defined in: src/lib/api-keys.ts:76

The prefix for identification (stored in DB for display)
