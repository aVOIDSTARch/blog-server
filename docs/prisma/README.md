[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / prisma

# prisma

## Description

Prisma client singleton for database operations.

This module provides a configured Prisma client instance with:
- PostgreSQL adapter using `pg` pool
- Connection pooling for efficient database access
- Development logging (queries, errors, warnings)
- Production-optimized settings (errors only)
- Global singleton pattern to prevent connection leaks

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `NODE_ENV` - Environment mode (affects logging)

## Usage

```typescript
import { prisma } from './lib/prisma';

// Query the database
const users = await prisma.users.findMany();

// Create a record
const site = await prisma.sites.create({
  data: { name: 'My Blog', slug: 'my-blog', owner_id: userId }
});
```

## Remarks

The client is cached globally in development to prevent
connection exhaustion during hot reloading.

## Variables

- [prisma](variables/prisma.md)

## References

### default

Renames and re-exports [prisma](variables/prisma.md)
