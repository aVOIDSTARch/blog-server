[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / isOriginAllowed

# Function: isOriginAllowed()

> **isOriginAllowed**(`apiKey`, `origin`): `boolean`

Defined in: src/lib/api-keys.ts:733

Checks if an origin is allowed for an API key (CORS).

## Parameters

### apiKey

[`ValidatedApiKey`](../interfaces/ValidatedApiKey.md)

The validated API key to check

### origin

`string`

The request origin header value

## Returns

`boolean`

True if the origin is allowed (or no restrictions are set)
