[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / users

# users

## Description

User management routes for the Blog Server API.

This module provides RESTful endpoints for managing users:
- List all users (admin only)
- Get current authenticated user
- Get user profile details
- Update user profiles
- Get user's accessible sites
- Delete users (admin only)

## Authentication

Access is determined by API key type:
- **Admin keys**: Full access to all user operations
- **User keys**: Can view/update own profile only
- **Site keys**: Limited access (no user management)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/users | List all users (admin) |
| GET | /api/users/me | Get current user |
| GET | /api/users/:userId | Get user profile |
| PATCH | /api/users/:userId | Update user profile |
| GET | /api/users/:userId/sites | Get user's sites |
| DELETE | /api/users/:userId | Delete user (admin) |

## Variables

- [default](variables/default.md)
