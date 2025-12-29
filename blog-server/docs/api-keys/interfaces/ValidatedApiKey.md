[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / ValidatedApiKey

# Interface: ValidatedApiKey

Defined in: src/lib/api-keys.ts:124

Represents a validated API key with its permissions and restrictions.

## Remarks

This interface is returned after successful validation and contains
all information needed for authorization decisions.

## Properties

### allowedIps

> **allowedIps**: `string`[]

Defined in: src/lib/api-keys.ts:142

List of allowed IP addresses

***

### allowedOrigins

> **allowedOrigins**: `string`[]

Defined in: src/lib/api-keys.ts:144

List of allowed origins

***

### id

> **id**: `string`

Defined in: src/lib/api-keys.ts:126

Unique identifier of the API key

***

### keyType

> **keyType**: `api_key_type`

Defined in: src/lib/api-keys.ts:130

Type of API key (user, site, admin)

***

### name

> **name**: `string`

Defined in: src/lib/api-keys.ts:128

Human-readable name

***

### rateLimitPerDay

> **rateLimitPerDay**: `number`

Defined in: src/lib/api-keys.ts:140

Maximum requests per day

***

### rateLimitPerMinute

> **rateLimitPerMinute**: `number`

Defined in: src/lib/api-keys.ts:138

Maximum requests per minute

***

### scopes

> **scopes**: `api_key_scope`[]

Defined in: src/lib/api-keys.ts:136

Granted permission scopes

***

### siteId

> **siteId**: `string` \| `null`

Defined in: src/lib/api-keys.ts:134

Associated site ID (null for user/admin keys)

***

### userId

> **userId**: `string` \| `null`

Defined in: src/lib/api-keys.ts:132

Associated user ID (null for admin keys)
