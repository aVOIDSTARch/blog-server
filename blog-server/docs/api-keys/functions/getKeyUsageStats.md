[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / getKeyUsageStats

# Function: getKeyUsageStats()

> **getKeyUsageStats**(`prisma`, `apiKeyId`, `options?`): `Promise`\<\{ `avgResponseTime`: `number`; `failedRequests`: `number`; `successfulRequests`: `number`; `topEndpoints`: `object`[]; `totalRequests`: `number`; \}\>

Defined in: src/lib/api-keys.ts:589

Gets usage statistics for an API key.

## Parameters

### prisma

`PrismaClient`

The Prisma client instance

### apiKeyId

`string`

The API key ID to get stats for

### options?

Optional date range filter

#### endDate?

`Date`

#### startDate?

`Date`

## Returns

`Promise`\<\{ `avgResponseTime`: `number`; `failedRequests`: `number`; `successfulRequests`: `number`; `topEndpoints`: `object`[]; `totalRequests`: `number`; \}\>

Aggregated usage statistics
