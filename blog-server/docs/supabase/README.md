[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / supabase

# supabase

## Description

Supabase client for authentication and storage operations.

This module provides a configured Supabase client instance for:
- User authentication via Supabase Auth
- File storage operations
- Realtime subscriptions (if needed)

## Environment Variables

- `SUPABASE_URL` - Your Supabase project URL (required)
- `SUPABASE_ANON_KEY` - Public anonymous key (required)

## Usage

```typescript
import { supabase } from './lib/supabase';

// Authentication
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});

// Storage
const { data } = await supabase.storage
  .from('avatars')
  .upload('public/avatar.png', file);
```

## Remarks

This client uses the anonymous (public) key which has limited
permissions defined by your Supabase RLS policies.

## Variables

- [supabase](variables/supabase.md)

## References

### default

Renames and re-exports [supabase](variables/supabase.md)
