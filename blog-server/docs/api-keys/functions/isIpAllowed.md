[**Blog Server API Documentation v0.0.0**](../../README.md)

***

[Blog Server API Documentation](../../README.md) / [api-keys](../README.md) / isIpAllowed

# Function: isIpAllowed()

> **isIpAllowed**(`apiKey`, `ip`): `boolean`

Defined in: src/lib/api-keys.ts:718

Checks if an IP address is allowed for an API key.

## Parameters

### apiKey

[`ValidatedApiKey`](../interfaces/ValidatedApiKey.md)

The validated API key to check

### ip

`string`

The client IP address

## Returns

`boolean`

True if the IP is allowed (or no restrictions are set)
