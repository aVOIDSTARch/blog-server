[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / categories

# categories

## Description

Category management routes for the Blog Server API.

This module provides RESTful endpoints for managing post categories:
- List categories for a site
- Create new categories
- Update existing categories
- Delete categories

## Features

- **Hierarchical**: Categories support parent-child relationships
- **Site-scoped**: Categories belong to a specific site
- **Post counts**: Category listings include post counts

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/sites/:siteId/categories | List site categories |
| POST | /api/sites/:siteId/categories | Create category |
| PATCH | /api/categories/:categoryId | Update category |
| DELETE | /api/categories/:categoryId | Delete category |

## Variables

- [default](variables/default.md)
