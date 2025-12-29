[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / revokeSiteAccess

# Function: revokeSiteAccess()

> **revokeSiteAccess**(`prisma`, `apiKeyId`, `siteId`): `Promise`\<`void`\>

Defined in: src/lib/api-keys.ts:699

Revokes an API key's access to a specific site.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### apiKeyId

`string`

The API key to revoke access from

### siteId

`string`

The site to revoke access for

## Returns

`Promise`\<`void`\>
