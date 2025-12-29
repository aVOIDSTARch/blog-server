[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / CreateApiKeyOptions

# Interface: CreateApiKeyOptions

Defined in: src/lib/api-keys.ts:90

Options for creating a new API key.

## Remarks

Different key types have different requirements:
- **admin**: Cannot have userId or siteId
- **user**: Requires userId
- **site**: Requires both userId and siteId

## Properties

### allowedIps?

> `optional` **allowedIps**: `string`[]

Defined in: src/lib/api-keys.ts:110

Allowed IP addresses (empty = all allowed)

***

### allowedOrigins?

> `optional` **allowedOrigins**: `string`[]

Defined in: src/lib/api-keys.ts:112

Allowed origins for CORS (empty = all allowed)

***

### description?

> `optional` **description**: `string`

Defined in: src/lib/api-keys.ts:94

Optional description of the key's purpose

***

### expiresAt?

> `optional` **expiresAt**: `Date`

Defined in: src/lib/api-keys.ts:108

Expiration date (optional)

***

### keyType

> **keyType**: `api_key_type`

Defined in: src/lib/api-keys.ts:96

Type of API key to create

***

### metadata?

> `optional` **metadata**: `object`

Defined in: src/lib/api-keys.ts:114

Additional metadata as JSON

***

### name

> **name**: `string`

Defined in: src/lib/api-keys.ts:92

Human-readable name for the API key

***

### rateLimitPerDay?

> `optional` **rateLimitPerDay**: `number`

Defined in: src/lib/api-keys.ts:106

Rate limit per day (defaults to 10000)

***

### rateLimitPerMinute?

> `optional` **rateLimitPerMinute**: `number`

Defined in: src/lib/api-keys.ts:104

Rate limit per minute (defaults to 60)

***

### scopes?

> `optional` **scopes**: `api_key_scope`[]

Defined in: src/lib/api-keys.ts:102

Permission scopes (defaults to ['read'])

***

### siteId?

> `optional` **siteId**: `string`

Defined in: src/lib/api-keys.ts:100

Site ID for site-scoped keys

***

### userId?

> `optional` **userId**: `string`

Defined in: src/lib/api-keys.ts:98

User ID for user/site keys
