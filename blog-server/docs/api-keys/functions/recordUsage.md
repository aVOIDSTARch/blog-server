[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / recordUsage

# Function: recordUsage()

> **recordUsage**(`prisma`, `apiKeyId`, `options`): `Promise`\<`void`\>

Defined in: src/lib/api-keys.ts:455

Records API key usage for analytics and rate limiting.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### apiKeyId

`string`

The ID of the API key being used

### options

Details about the request being made

#### endpoint

`string`

#### ipAddress?

`string`

#### method

`string`

#### origin?

`string`

#### resourceId?

`string`

#### resourceType?

`string`

#### responseTimeMs?

`number`

#### statusCode?

`number`

#### userAgent?

`string`

## Returns

`Promise`\<`void`\>

## Remarks

This function updates both the key's usage count/last used timestamp
and creates a detailed usage log entry for analytics.
