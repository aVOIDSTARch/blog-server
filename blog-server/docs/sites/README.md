[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / sites

# sites

## Description

Site management routes for the Blog Server API.

This module provides RESTful endpoints for managing blog sites:
- List accessible sites
- Get site details with owner/member information
- Create new sites
- Update site settings
- Delete sites (admin only)
- Get site statistics

## Authentication

All routes require API key authentication. Access is determined by key type:
- **Admin keys**: Full access to all sites
- **User keys**: Access to owned sites and sites with membership
- **Site keys**: Access to the specific site only

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/sites | List accessible sites |
| GET | /api/sites/:siteId | Get site details |
| POST | /api/sites | Create a new site |
| PATCH | /api/sites/:siteId | Update site settings |
| DELETE | /api/sites/:siteId | Delete a site (admin) |
| GET | /api/sites/:siteId/stats | Get site statistics |

## Variables

- [default](variables/default.md)
