[**Blog Server API Documentation v0.0.0**](../README.md)

***

[Blog Server API Documentation](../README.md) / posts

# posts

## Description

Post management routes for the Blog Server API.

This module provides RESTful endpoints for managing blog posts:
- List posts for a site with filtering and pagination
- Get individual post details
- Create new posts with categories, tags, and SEO metadata
- Update existing posts
- Delete posts

## Features

- **Pagination**: All list endpoints support page/limit parameters
- **Filtering**: Filter by status, author, category, tag, or search text
- **Sorting**: Sort by any field in ascending or descending order
- **Word Count**: Automatic word count and reading time calculation
- **SEO**: Support for custom SEO metadata per post

## Authentication

All routes require API key authentication with appropriate scopes:
- `read` scope: List and view posts
- `write` scope: Create and update posts
- `delete` scope: Delete posts

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/sites/:siteId/posts | List posts for a site |
| GET | /api/posts/:postId | Get post details |
| POST | /api/sites/:siteId/posts | Create a new post |
| PATCH | /api/posts/:postId | Update a post |
| DELETE | /api/posts/:postId | Delete a post |

## Variables

- [default](variables/default.md)
