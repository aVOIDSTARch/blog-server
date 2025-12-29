[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / grantSiteAccess

# Function: grantSiteAccess()

> **grantSiteAccess**(`prisma`, `apiKeyId`, `siteId`, `scopes`): `Promise`\<`void`\>

Defined in: src/lib/api-keys.ts:671

Grants an API key access to a specific site with specified scopes.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### apiKeyId

`string`

The API key to grant access to

### siteId

`string`

The site to grant access for

### scopes

`api_key_scope`[]

The permission scopes to grant

## Returns

`Promise`\<`void`\>
