# Blog Server API

A RESTful API server for managing multi-tenant blog sites, built with Express, Prisma, and PostgreSQL.

## Features

- Multi-tenant blog management (sites, posts, categories, tags)
- API key authentication with scopes and rate limiting
- IP and origin restrictions for API keys
- Usage tracking and statistics
- OpenAPI documentation with Swagger UI
- TypeDoc code documentation

## Prerequisites

- Node.js 18+
- PostgreSQL database
- Supabase project (for authentication)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/blog_db

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# API Server
API_PORT=3001
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Environment
NODE_ENV=development
```

### 3. Initialize the database

Generate the Prisma client and run migrations:

```bash
npx prisma generate
npx prisma db push
```

Optionally seed initial data:

```bash
npm run db:init
```

### 4. Start the server

Development mode (with hot reload):

```bash
npm run dev:api
```

Production mode:

```bash
npm run start:api
```

## API Documentation

Once the server is running:

- **Swagger UI**: http://localhost:3001/api/docs
- **OpenAPI Spec**: http://localhost:3001/api/openapi.json
- **TypeDoc**: http://localhost:3001/api/typedoc
- **Health Check**: http://localhost:3001/api/health

## Authentication

All API routes (except health, docs, and info endpoints) require authentication via API key.

### Providing API Keys

Include your API key in requests using one of these methods:

```bash
# Authorization header
curl -H "Authorization: Bearer sk_live_your_key" http://localhost:3001/api/sites

# X-API-Key header
curl -H "X-API-Key: sk_live_your_key" http://localhost:3001/api/sites
```

### Key Types

| Type | Prefix | Description |
|------|--------|-------------|
| user | `sk_*` | User-scoped access to owned/member sites |
| site | `ss_*` | Access to a specific site only |
| admin | `sa_*` | Full system access |

### Scopes

- `read` - View resources
- `write` - Create and update resources
- `delete` - Remove resources
- `admin` - Full access

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev`         | Start Vite dev server (frontend) |
| `npm run dev:api`.    | Start API server with hot reload |
| `npm run start:api`   | Start API server |
| `npm run build`       | Build for production |
| `npm run test`        | Run tests |
| `npm run test:watch`  | Run tests in watch mode |
| `npm run docs`        | Generate TypeDoc documentation |
| `npm run db:init`     | Initialize database with seed data |

## Project Structure

```
blog-server/
├── api/
│   ├── middleware/
│   │   └── auth.ts          # Authentication middleware
│   ├── routes/
│   │   ├── sites.ts         # Site management
│   │   ├── posts.ts         # Post management
│   │   ├── users.ts         # User management
│   │   ├── api-keys.ts      # API key management
│   │   ├── categories.ts    # Category management
│   │   └── tags.ts          # Tag management
│   ├── openapi.yaml         # OpenAPI specification
│   └── server.ts            # Express server setup
├── src/
│   └── lib/
│       ├── api-keys.ts      # API key functions
│       ├── prisma.ts        # Database client
│       └── supabase.ts      # Supabase client
├── prisma/
│   └── schema.prisma        # Database schema
├── tests/                   # Test files
├── docs/                    # Generated TypeDoc docs
└── typedoc.json            # TypeDoc configuration
```

## API Endpoints

### Sites
- `GET /api/sites` - List accessible sites
- `GET /api/sites/:siteId` - Get site details
- `POST /api/sites` - Create a site
- `PATCH /api/sites/:siteId` - Update a site
- `DELETE /api/sites/:siteId` - Delete a site (admin)
- `GET /api/sites/:siteId/stats` - Get site statistics

### Posts
- `GET /api/sites/:siteId/posts` - List posts
- `GET /api/posts/:postId` - Get post details
- `POST /api/sites/:siteId/posts` - Create a post
- `PATCH /api/posts/:postId` - Update a post
- `DELETE /api/posts/:postId` - Delete a post

### Users
- `GET /api/users` - List users (admin)
- `GET /api/users/me` - Get current user
- `GET /api/users/:userId` - Get user profile
- `PATCH /api/users/:userId` - Update user
- `DELETE /api/users/:userId` - Delete user (admin)

### API Keys
- `GET /api/api-keys` - List API keys
- `POST /api/api-keys` - Create API key
- `PATCH /api/api-keys/:keyId` - Update API key
- `POST /api/api-keys/:keyId/revoke` - Revoke API key
- `GET /api/api-keys/:keyId/usage` - Get usage stats

### Categories & Tags
- `GET /api/sites/:siteId/categories` - List categories
- `POST /api/sites/:siteId/categories` - Create category
- `GET /api/sites/:siteId/tags` - List tags
- `POST /api/sites/:siteId/tags` - Create tag

## Testing

Run the test suite:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

## License

MIT
