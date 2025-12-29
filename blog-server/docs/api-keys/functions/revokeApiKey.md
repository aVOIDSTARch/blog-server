[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / revokeApiKey

# Function: revokeApiKey()

> **revokeApiKey**(`prisma`, `apiKeyId`, `revokedBy?`, `reason?`): `Promise`\<`void`\>

Defined in: src/lib/api-keys.ts:519

Revokes an API key, preventing further use.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### apiKeyId

`string`

The ID of the API key to revoke

### revokedBy?

`string`

Optional user ID of who revoked the key

### reason?

`string`

Optional reason for revocation

## Returns

`Promise`\<`void`\>

## Remarks

Revoked keys cannot be reactivated. Create a new key instead.
