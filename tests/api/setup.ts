import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { authenticateApiKey } from "../../api/middleware/auth";
import sitesRouter from "../../api/routes/sites";
import postsRouter from "../../api/routes/posts";
import usersRouter from "../../api/routes/users";
import apiKeysRouter from "../../api/routes/api-keys";
import categoriesRouter from "../../api/routes/categories";
import tagsRouter from "../../api/routes/tags";
import { createApiKey } from "../../src/lib/api-keys";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

// Test data prefix
export const API_TEST_PREFIX = "apitest";
export const API_TEST_SLUG_PREFIX = "apitest-";
export const API_TEST_USERNAME_PREFIX = "apitest_";

// Test data storage
export interface ApiTestData {
  userId?: string;
  siteId?: string;
  postId?: string;
  categoryId?: string;
  tagId?: string;
  adminApiKey?: { id: string; key: string };
  userApiKey?: { id: string; key: string };
  siteApiKey?: { id: string; key: string };
  readOnlyApiKey?: { id: string; key: string };
}

export const apiTestData: ApiTestData = {};

// Prisma client
let testPrisma: PrismaClient | null = null;
let testPool: Pool | null = null;

export function getApiTestPrisma(): PrismaClient {
  if (!testPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    testPool = new Pool({ connectionString });
    const adapter = new PrismaPg(testPool);
    testPrisma = new PrismaClient({ adapter });
  }
  return testPrisma;
}

export async function disconnectApiTestPrisma(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

// Create Express app for testing
export function createTestApp(prisma: PrismaClient): express.Application {
  const app = express();

  // Load OpenAPI specification
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const openapiSpec = parse(
    readFileSync(join(__dirname, "../../api/openapi.yaml"), "utf-8")
  );

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check (no auth)
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API info (no auth)
  app.get("/api", (_req, res) => {
    res.json({
      name: "Blog API",
      version: "1.0.0",
      documentation: "/api/docs",
    });
  });

  // Swagger UI (no auth)
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  // OpenAPI spec (no auth)
  app.get("/api/openapi.json", (_req, res) => {
    res.json(openapiSpec);
  });

  // Apply authentication to remaining routes
  app.use("/api", (req, res, next) => {
    if (req.path === "/health" || req.path === "/" || req.path.startsWith("/docs") || req.path === "/openapi.json") {
      return next();
    }
    return authenticateApiKey(prisma)(req, res, next);
  });

  // Register routes
  app.use("/api/sites", sitesRouter);
  app.use("/api", postsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/api-keys", apiKeysRouter);
  app.use("/api", categoriesRouter);
  app.use("/api", tagsRouter);

  // 404 handler
  app.use("/api/{*splat}", (_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  // Error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Test app error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}

// Setup test data
export async function setupApiTestData(): Promise<ApiTestData> {
  const prisma = getApiTestPrisma();

  // Clean up any existing test data first
  await cleanupApiTestData();

  // 1. Create test user
  const userId = randomUUID();
  const testEmail = `${API_TEST_PREFIX}_user@test.local`;

  await prisma.auth_users.create({
    data: {
      id: userId,
      instance_id: "00000000-0000-0000-0000-000000000000",
      aud: "authenticated",
      role: "authenticated",
      email: testEmail,
      encrypted_password: "$2a$10$placeholder.hash.for.testing.only",
      email_confirmed_at: new Date(),
      raw_app_meta_data: { provider: "email", providers: ["email"] },
      raw_user_meta_data: {
        display_name: `${API_TEST_PREFIX}_User`,
        username: `${API_TEST_USERNAME_PREFIX}user`,
      },
      created_at: new Date(),
      updated_at: new Date(),
      confirmation_token: "",
      recovery_token: "",
      email_change_token_new: "",
      email_change: "",
    },
  });

  await prisma.public_users.update({
    where: { id: userId },
    data: {
      username: `${API_TEST_USERNAME_PREFIX}user`,
      display_name: `${API_TEST_PREFIX}_User`,
      bio: `${API_TEST_PREFIX}_Bio`,
    },
  });
  apiTestData.userId = userId;

  // 2. Create test site
  const site = await prisma.sites.create({
    data: {
      name: `${API_TEST_PREFIX}_Site`,
      slug: `${API_TEST_SLUG_PREFIX}site`,
      domain: `${API_TEST_SLUG_PREFIX}site.example.com`,
      description: `${API_TEST_PREFIX}_Test site`,
      owner_id: userId,
    },
  });
  apiTestData.siteId = site.id;

  // 3. Create test category
  const category = await prisma.categories.create({
    data: {
      name: `${API_TEST_PREFIX}_Category`,
      slug: `${API_TEST_SLUG_PREFIX}category`,
      site_id: site.id,
    },
  });
  apiTestData.categoryId = category.id;

  // 4. Create test tag
  const tag = await prisma.tags.create({
    data: {
      name: `${API_TEST_PREFIX}_Tag`,
      slug: `${API_TEST_SLUG_PREFIX}tag`,
      site_id: site.id,
    },
  });
  apiTestData.tagId = tag.id;

  // 5. Create test post
  const post = await prisma.posts.create({
    data: {
      title: `${API_TEST_PREFIX}_Post`,
      slug: `${API_TEST_SLUG_PREFIX}post`,
      content: `# ${API_TEST_PREFIX}_Post\n\nTest content`,
      content_format: "markdown",
      author_id: userId,
      site_id: site.id,
      status: "published",
    },
  });
  apiTestData.postId = post.id;

  // 6. Create API keys for testing
  // Admin key - full access
  const adminKey = await createApiKey(prisma, {
    name: `${API_TEST_PREFIX}_admin_key`,
    keyType: "admin",
    scopes: ["read", "write", "delete", "admin"],
  });
  apiTestData.adminApiKey = { id: adminKey.id, key: adminKey.apiKey.key };

  // User key - user-level access
  const userKey = await createApiKey(prisma, {
    name: `${API_TEST_PREFIX}_user_key`,
    keyType: "user",
    userId: userId,
    scopes: ["read", "write", "delete"],
  });
  apiTestData.userApiKey = { id: userKey.id, key: userKey.apiKey.key };

  // Site key - site-specific access
  const siteKey = await createApiKey(prisma, {
    name: `${API_TEST_PREFIX}_site_key`,
    keyType: "site",
    userId: userId,
    siteId: site.id,
    scopes: ["read", "write"],
  });
  apiTestData.siteApiKey = { id: siteKey.id, key: siteKey.apiKey.key };

  // Read-only key
  const readOnlyKey = await createApiKey(prisma, {
    name: `${API_TEST_PREFIX}_readonly_key`,
    keyType: "user",
    userId: userId,
    scopes: ["read"],
  });
  apiTestData.readOnlyApiKey = { id: readOnlyKey.id, key: readOnlyKey.apiKey.key };

  return apiTestData;
}

// Cleanup test data
export async function cleanupApiTestData(): Promise<void> {
  const prisma = getApiTestPrisma();

  try {
    // Delete API keys
    await prisma.api_key_usage.deleteMany({
      where: {
        api_keys: { name: { startsWith: API_TEST_PREFIX } },
      },
    }).catch(() => {});

    await prisma.api_key_site_access.deleteMany({
      where: {
        api_keys: { name: { startsWith: API_TEST_PREFIX } },
      },
    }).catch(() => {});

    await prisma.api_keys.deleteMany({
      where: { name: { startsWith: API_TEST_PREFIX } },
    }).catch(() => {});

    // Delete posts and related data
    const posts = await prisma.posts.findMany({
      where: { slug: { startsWith: API_TEST_SLUG_PREFIX } },
      select: { id: true },
    });
    for (const post of posts) {
      await prisma.post_tags.deleteMany({ where: { post_id: post.id } }).catch(() => {});
      await prisma.post_categories.deleteMany({ where: { post_id: post.id } }).catch(() => {});
      await prisma.post_stats.deleteMany({ where: { post_id: post.id } }).catch(() => {});
      await prisma.post_seo.deleteMany({ where: { post_id: post.id } }).catch(() => {});
      await prisma.comments.deleteMany({ where: { post_id: post.id } }).catch(() => {});
    }
    await prisma.posts.deleteMany({
      where: { slug: { startsWith: API_TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete tags
    await prisma.tags.deleteMany({
      where: { slug: { startsWith: API_TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete categories
    await prisma.categories.deleteMany({
      where: { slug: { startsWith: API_TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete site members
    await prisma.site_members.deleteMany({
      where: {
        sites: { slug: { startsWith: API_TEST_SLUG_PREFIX } },
      },
    }).catch(() => {});

    // Delete sites
    await prisma.sites.deleteMany({
      where: { slug: { startsWith: API_TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete users
    await prisma.public_users.deleteMany({
      where: { username: { startsWith: API_TEST_USERNAME_PREFIX } },
    }).catch(() => {});

    await prisma.auth_users.deleteMany({
      where: { email: { startsWith: API_TEST_PREFIX } },
    }).catch(() => {});

  } catch (error) {
    console.warn("Warning during API test cleanup:", error);
  }
}
