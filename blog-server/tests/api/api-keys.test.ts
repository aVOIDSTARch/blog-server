import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  getApiTestPrisma,
  disconnectApiTestPrisma,
  setupApiTestData,
  cleanupApiTestData,
  createTestApp,
  apiTestData,
  API_TEST_PREFIX,
} from "./setup";

describe("API Keys API", () => {
  let app: ReturnType<typeof createTestApp>;
  let createdKeyIds: string[] = [];

  beforeAll(async () => {
    const prisma = getApiTestPrisma();
    await setupApiTestData();
    app = createTestApp(prisma);
  });

  afterAll(async () => {
    const prisma = getApiTestPrisma();
    // Cleanup created keys
    for (const keyId of createdKeyIds) {
      await prisma.api_key_usage.deleteMany({ where: { api_key_id: keyId } }).catch(() => {});
      await prisma.api_key_site_access.deleteMany({ where: { api_key_id: keyId } }).catch(() => {});
      await prisma.api_keys.delete({ where: { id: keyId } }).catch(() => {});
    }
    await cleanupApiTestData();
    await disconnectApiTestPrisma();
  });

  describe("GET /api/api-keys", () => {
    it("should list all API keys for admin", async () => {
      const res = await request(app)
        .get("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("count");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should list only user's API keys for user key", async () => {
      const res = await request(app)
        .get("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
      // User should see at least their own keys (userApiKey, siteApiKey, readOnlyApiKey)
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter keys by type for admin", async () => {
      const res = await request(app)
        .get("/api/api-keys?key_type=admin")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      for (const key of res.body.data) {
        expect(key.key_type).toBe("admin");
      }
    });

    it("should filter keys by active status", async () => {
      const res = await request(app)
        .get("/api/api-keys?is_active=true")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      for (const key of res.body.data) {
        expect(key.is_active).toBe(true);
      }
    });
  });

  describe("GET /api/api-keys/:keyId", () => {
    it("should get a specific API key by ID", async () => {
      const res = await request(app)
        .get(`/api/api-keys/${apiTestData.userApiKey!.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("id", apiTestData.userApiKey!.id);
      expect(res.body.data).toHaveProperty("name");
      expect(res.body.data).toHaveProperty("key_type");
      // Should not expose the actual key
      expect(res.body.data).not.toHaveProperty("key_hash");
    });

    it("should return 404 for non-existent key", async () => {
      const res = await request(app)
        .get("/api/api-keys/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "API key not found");
    });

    it("should deny access to other users' keys", async () => {
      const res = await request(app)
        .get(`/api/api-keys/${apiTestData.adminApiKey!.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/api-keys", () => {
    it("should create a new user API key", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: `${API_TEST_PREFIX}_new_user_key`,
          description: "Test user key created via API",
          scopes: ["read", "write"],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("id");
      expect(res.body.data).toHaveProperty("key"); // Full key shown only on creation
      expect(res.body.data).toHaveProperty("key_prefix");
      expect(res.body).toHaveProperty("message");

      createdKeyIds.push(res.body.data.id);
    });

    it("should create an admin key (admin only)", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({
          name: `${API_TEST_PREFIX}_new_admin_key`,
          key_type: "admin",
          scopes: ["read", "write", "delete", "admin"],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("key_type", "admin");

      createdKeyIds.push(res.body.data.id);
    });

    it("should deny admin key creation for non-admin", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: `${API_TEST_PREFIX}_should_fail`,
          key_type: "admin",
          scopes: ["admin"],
        });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error", "Forbidden");
    });

    it("should reject key creation without name", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          description: "Key without name",
          scopes: ["read"],
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Bad Request");
    });

    it("should create site key for owned site", async () => {
      const res = await request(app)
        .post("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: `${API_TEST_PREFIX}_new_site_key`,
          key_type: "site",
          site_id: apiTestData.siteId,
          scopes: ["read"],
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("key_type", "site");

      createdKeyIds.push(res.body.data.id);
    });
  });

  describe("PATCH /api/api-keys/:keyId", () => {
    it("should update API key name and description", async () => {
      const res = await request(app)
        .patch(`/api/api-keys/${apiTestData.userApiKey!.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: `${API_TEST_PREFIX}_updated_key`,
          description: "Updated description",
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("description", "Updated description");
    });

    it("should update rate limits", async () => {
      const res = await request(app)
        .patch(`/api/api-keys/${apiTestData.userApiKey!.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          rate_limit_per_minute: 100,
          rate_limit_per_day: 5000,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("rate_limit_per_minute", 100);
      expect(res.body.data).toHaveProperty("rate_limit_per_day", 5000);
    });

    it("should deny updating other users' keys", async () => {
      const res = await request(app)
        .patch(`/api/api-keys/${apiTestData.adminApiKey!.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ description: "Should not update" });

      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/api-keys/:keyId/revoke", () => {
    it("should revoke an API key", async () => {
      // Create a key to revoke
      const createRes = await request(app)
        .post("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: `${API_TEST_PREFIX}_to_revoke`,
          scopes: ["read"],
        });

      const keyId = createRes.body.data.id;
      createdKeyIds.push(keyId);

      const res = await request(app)
        .post(`/api/api-keys/${keyId}/revoke`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ reason: "Testing revocation" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "API key revoked successfully");

      // Verify key is revoked
      const prisma = getApiTestPrisma();
      const revokedKey = await prisma.api_keys.findUnique({ where: { id: keyId } });
      expect(revokedKey?.is_active).toBe(false);
      expect(revokedKey?.revoked_at).not.toBeNull();
    });

    it("should deny revoking other users' keys", async () => {
      const res = await request(app)
        .post(`/api/api-keys/${apiTestData.adminApiKey!.id}/revoke`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ reason: "Should not work" });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/api-keys/:keyId/usage", () => {
    it("should get API key usage statistics", async () => {
      const res = await request(app)
        .get(`/api/api-keys/${apiTestData.userApiKey!.id}/usage`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
    });

    it("should filter usage by date range", async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      const res = await request(app)
        .get(`/api/api-keys/${apiTestData.userApiKey!.id}/usage`)
        .query({
          start_date: startDate.toISOString(),
          end_date: new Date().toISOString(),
        })
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/api-keys/:keyId/site-access", () => {
    it("should grant site access to an API key", async () => {
      const res = await request(app)
        .post(`/api/api-keys/${apiTestData.userApiKey!.id}/site-access`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          site_id: apiTestData.siteId,
          scopes: ["read", "write"],
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Site access granted successfully");
    });

    it("should reject without required fields", async () => {
      const res = await request(app)
        .post(`/api/api-keys/${apiTestData.userApiKey!.id}/site-access`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ site_id: apiTestData.siteId });

      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/api-keys/:keyId/site-access/:siteId", () => {
    it("should revoke site access from an API key", async () => {
      // First grant access
      await request(app)
        .post(`/api/api-keys/${apiTestData.userApiKey!.id}/site-access`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          site_id: apiTestData.siteId,
          scopes: ["read"],
        });

      // Then revoke it
      const res = await request(app)
        .delete(`/api/api-keys/${apiTestData.userApiKey!.id}/site-access/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message", "Site access revoked successfully");
    });
  });
});
