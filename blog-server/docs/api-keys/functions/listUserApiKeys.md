[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / listUserApiKeys

# Function: listUserApiKeys()

> **listUserApiKeys**(`prisma`, `userId`): `Promise`\<`object`[]\>

Defined in: src/lib/api-keys.ts:543

Lists all API keys belonging to a specific user.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### userId

`string`

The user ID to list keys for

## Returns

`Promise`\<`object`[]\>

Array of API key summaries (without the actual key values)
