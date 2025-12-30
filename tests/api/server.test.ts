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

describe("API Server Infrastructure", () => {
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

  describe("Health Check Endpoint", () => {
    it("should return health status without authentication", async () => {
      const res = await request(app).get("/api/health");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("timestamp");
      expect(new Date(res.body.timestamp)).toBeInstanceOf(Date);
    });

    it("should return valid ISO timestamp", async () => {
      const res = await request(app).get("/api/health");

      const timestamp = new Date(res.body.timestamp);
      expect(timestamp.toISOString()).toBe(res.body.timestamp);
    });
  });

  describe("API Info Endpoint", () => {
    it("should return API information without authentication", async () => {
      const res = await request(app).get("/api");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("name", "Blog API");
      expect(res.body).toHaveProperty("version", "1.0.0");
      expect(res.body).toHaveProperty("documentation", "/api/docs");
    });
  });

  describe("OpenAPI Specification", () => {
    it("should serve OpenAPI spec as JSON without authentication", async () => {
      const res = await request(app).get("/api/openapi.json");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("openapi");
      expect(res.body.openapi).toMatch(/^3\./);
      expect(res.body).toHaveProperty("info");
      expect(res.body.info).toHaveProperty("title", "Blog API");
    });

    it("should include API paths in OpenAPI spec", async () => {
      const res = await request(app).get("/api/openapi.json");

      expect(res.body).toHaveProperty("paths");
      expect(Object.keys(res.body.paths).length).toBeGreaterThan(0);
    });

    it("should include security schemes in OpenAPI spec", async () => {
      const res = await request(app).get("/api/openapi.json");

      expect(res.body).toHaveProperty("components");
      expect(res.body.components).toHaveProperty("securitySchemes");
    });
  });

  describe("Swagger UI Documentation", () => {
    it("should serve Swagger UI without authentication", async () => {
      const res = await request(app).get("/api/docs/");

      expect(res.status).toBe(200);
      expect(res.text).toContain("swagger-ui");
    });

    it("should serve Swagger UI HTML", async () => {
      const res = await request(app).get("/api/docs/");

      // Verify it's serving HTML content with swagger-ui
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
    });
  });

  describe("404 Handler", () => {
    it("should return 404 for unknown API endpoints", async () => {
      const res = await request(app)
        .get("/api/nonexistent-endpoint")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Not Found");
    });

    it("should return 404 for deeply nested unknown paths", async () => {
      const res = await request(app)
        .get("/api/some/deep/nested/path")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Not Found");
    });

    it("should return 404 for unknown API methods on valid paths", async () => {
      const res = await request(app)
        .put("/api/sites") // PUT not supported
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({ name: "Test" });

      // May return 404 or 405 depending on implementation
      expect([404, 405]).toContain(res.status);
    });
  });

  describe("CORS Configuration", () => {
    it("should include CORS headers in response", async () => {
      const res = await request(app)
        .options("/api/sites")
        .set("Origin", "http://localhost:3000");

      expect(res.headers).toHaveProperty("access-control-allow-origin");
    });

    it("should allow specified HTTP methods", async () => {
      const res = await request(app)
        .options("/api/sites")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "GET");

      expect(res.headers["access-control-allow-methods"]).toContain("GET");
    });

    it("should allow Authorization header", async () => {
      const res = await request(app)
        .options("/api/sites")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Headers", "Authorization");

      expect(res.headers["access-control-allow-headers"]).toContain(
        "Authorization"
      );
    });

    it("should allow X-API-Key header", async () => {
      const res = await request(app)
        .options("/api/sites")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Headers", "X-API-Key");

      expect(res.headers["access-control-allow-headers"]).toContain("X-API-Key");
    });

    it("should allow Content-Type header", async () => {
      const res = await request(app)
        .options("/api/sites")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Headers", "Content-Type");

      expect(res.headers["access-control-allow-headers"]).toContain(
        "Content-Type"
      );
    });
  });

  describe("JSON Response Format", () => {
    it("should return JSON content type for API responses", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.headers["content-type"]).toContain("application/json");
    });

    it("should return JSON content type for error responses", async () => {
      const res = await request(app).get("/api/sites");

      expect(res.headers["content-type"]).toContain("application/json");
    });

    it("should handle malformed JSON in request body gracefully", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .set("Content-Type", "application/json")
        .send("{ invalid json }");

      // Express returns 400 or 500 depending on JSON parsing error handling
      expect([400, 500]).toContain(res.status);
    });
  });

  describe("Request Body Parsing", () => {
    it("should parse JSON request bodies", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({ name: "Test Site", slug: "test-site-json-parse" });

      // Either success or validation error, but should have parsed the body
      expect([201, 400, 409]).toContain(res.status);
    });

    it("should handle empty request body", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .set("Content-Type", "application/json")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("HTTP Methods", () => {
    it("should support GET requests", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should support POST requests", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ name: "HTTP Test Tag", slug: "http-test-tag" });

      expect([201, 409]).toContain(res.status);

      // Cleanup if created
      if (res.status === 201) {
        const prisma = getApiTestPrisma();
        await prisma.tags.delete({ where: { id: res.body.data.id } });
      }
    });

    it("should support PATCH requests", async () => {
      const res = await request(app)
        .patch(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ tagline: "Test tagline update" });

      expect(res.status).toBe(200);
    });

    it("should support DELETE requests", async () => {
      // Create something to delete
      const prisma = getApiTestPrisma();
      const tag = await prisma.tags.create({
        data: {
          name: "To Delete",
          slug: "server-test-to-delete",
          site_id: apiTestData.siteId!,
        },
      });

      const res = await request(app)
        .delete(`/api/tags/${tag.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(204);
    });

    it("should support OPTIONS requests for CORS preflight", async () => {
      const res = await request(app)
        .options("/api/sites")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST");

      expect(res.status).toBe(204);
    });
  });

  describe("Response Status Codes", () => {
    it("should return 200 for successful GET", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should return 201 for successful POST", async () => {
      const uniqueSlug = `server-test-${Date.now()}`;
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ name: "Created Tag", slug: uniqueSlug });

      expect(res.status).toBe(201);

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.tags.delete({ where: { id: res.body.data.id } });
    });

    it("should return 204 for successful DELETE", async () => {
      const prisma = getApiTestPrisma();
      const tag = await prisma.tags.create({
        data: {
          name: "To Delete 204",
          slug: `server-test-204-${Date.now()}`,
          site_id: apiTestData.siteId!,
        },
      });

      const res = await request(app)
        .delete(`/api/tags/${tag.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(204);
    });

    it("should return 400 for bad request", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({}); // Missing required fields

      expect(res.status).toBe(400);
    });

    it("should return 401 for unauthenticated request", async () => {
      const res = await request(app).get("/api/sites");

      expect(res.status).toBe(401);
    });

    it("should return 403 for unauthorized request", async () => {
      const res = await request(app)
        .delete(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`);

      expect(res.status).toBe(403);
    });

    it("should return 404 for not found", async () => {
      const res = await request(app)
        .get("/api/sites/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(404);
    });

    it("should return 409 for conflict (duplicate)", async () => {
      // Try to create a tag with same slug twice
      const slug = `conflict-test-${Date.now()}`;
      const prisma = getApiTestPrisma();

      await prisma.tags.create({
        data: {
          name: "First Tag",
          slug,
          site_id: apiTestData.siteId!,
        },
      });

      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ name: "Duplicate Tag", slug });

      expect(res.status).toBe(409);

      // Cleanup
      await prisma.tags.deleteMany({ where: { slug } });
    });
  });

  describe("Request Headers", () => {
    it("should accept Bearer token in Authorization header", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should accept X-API-Key header", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("X-API-Key", apiTestData.adminApiKey!.key);

      expect(res.status).toBe(200);
    });

    it("should prefer Bearer token over X-API-Key when both present", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .set("X-API-Key", apiTestData.readOnlyApiKey!.key);

      // Should use the admin key from Authorization header
      expect(res.status).toBe(200);
    });
  });
});
