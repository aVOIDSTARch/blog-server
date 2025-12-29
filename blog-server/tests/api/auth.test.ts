import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  getApiTestPrisma,
  disconnectApiTestPrisma,
  setupApiTestData,
  cleanupApiTestData,
  createTestApp,
  apiTestData,
} from "./setup";

describe("API Authentication", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(async () => {
    const prisma = getApiTestPrisma();
    await setupApiTestData();
    app = createTestApp(prisma);
  });

  afterAll(async () => {
    await cleanupApiTestData();
    await disconnectApiTestPrisma();
  });

  describe("Unauthenticated Endpoints", () => {
    it("should allow access to health check without auth", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("timestamp");
    });

    it("should allow access to API info without auth", async () => {
      const res = await request(app).get("/api");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("name", "Blog API");
      expect(res.body).toHaveProperty("version", "1.0.0");
      expect(res.body).toHaveProperty("documentation", "/api/docs");
    });

    it("should allow access to OpenAPI spec without auth", async () => {
      const res = await request(app).get("/api/openapi.json");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("openapi", "3.0.3");
      expect(res.body).toHaveProperty("info");
      expect(res.body.info).toHaveProperty("title", "Blog API");
    });

    it("should allow access to Swagger UI without auth", async () => {
      const res = await request(app).get("/api/docs/");

      expect(res.status).toBe(200);
      expect(res.text).toContain("swagger-ui");
    });
  });

  describe("Authentication Required", () => {
    it("should reject requests without API key", async () => {
      const res = await request(app).get("/api/sites");

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Unauthorized");
      expect(res.body).toHaveProperty("message", "API key is required");
    });

    it("should reject requests with invalid API key", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", "Bearer invalid_key_12345678");

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Unauthorized");
    });

    it("should reject requests with malformed Authorization header", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", "NotBearer somekey");

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Unauthorized");
    });

    it("should accept valid API key via Authorization header", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should accept valid API key via X-API-Key header", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("X-API-Key", apiTestData.adminApiKey!.key);

      expect(res.status).toBe(200);
    });
  });

  describe("Scope-based Authorization", () => {
    it("should allow read operations with read scope", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should deny write operations with read-only scope", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`)
        .send({ name: "Test Tag", slug: "test-tag" });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error", "Forbidden");
    });

    it("should allow write operations with write scope", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ name: "New Test Tag", slug: "apitest-new-tag" });

      expect(res.status).toBe(201);

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.tags.deleteMany({ where: { slug: "apitest-new-tag" } });
    });
  });

  describe("API Key Types", () => {
    it("should allow admin key to access all sites", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
    });

    it("should allow user key to access user's sites", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      // User key should only see sites owned by the user
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("should allow site key to access only its site", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.siteApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("id", apiTestData.siteId);
    });
  });

  describe("404 Handling", () => {
    it("should return 404 for unknown API endpoints", async () => {
      const res = await request(app)
        .get("/api/nonexistent-endpoint")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Not Found");
    });
  });
});
