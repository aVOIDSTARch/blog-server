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
import { createApiKey } from "../../src/lib/api-keys";

describe("Advanced Authentication", () => {
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
      await prisma.api_key_usage
        .deleteMany({ where: { api_key_id: keyId } })
        .catch(() => {});
      await prisma.api_key_site_access
        .deleteMany({ where: { api_key_id: keyId } })
        .catch(() => {});
      await prisma.api_keys.delete({ where: { id: keyId } }).catch(() => {});
    }
    await cleanupApiTestData();
    await disconnectApiTestPrisma();
  });

  describe("IP Restrictions", () => {
    it("should allow request when no IP restrictions configured", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should allow request from allowed IP", async () => {
      const prisma = getApiTestPrisma();

      // Create key with specific IP allowed (127.0.0.1 for local testing)
      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_ip_allowed`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        allowedIps: ["127.0.0.1", "::1", "::ffff:127.0.0.1"],
      });
      createdKeyIds.push(id);

      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`);

      expect(res.status).toBe(200);
    });

    it("should deny request from non-allowed IP", async () => {
      const prisma = getApiTestPrisma();

      // Create key with IP that won't match local requests
      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_ip_denied`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        allowedIps: ["192.168.100.100"], // Won't match local test
      });
      createdKeyIds.push(id);

      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error", "Forbidden");
      expect(res.body).toHaveProperty("message", "IP address not allowed");
    });
  });

  describe("Origin Restrictions", () => {
    it("should allow request when no origin restrictions configured", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .set("Origin", "http://example.com");

      expect(res.status).toBe(200);
    });

    it("should allow request without origin header when restrictions configured", async () => {
      const prisma = getApiTestPrisma();

      // Create key with origin restrictions - requests without Origin header should pass
      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_origin_no_header`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        allowedOrigins: ["http://allowed.example.com"],
      });
      createdKeyIds.push(id);

      // Request without Origin header
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`);

      expect(res.status).toBe(200);
    });

    it("should allow request from allowed origin", async () => {
      const prisma = getApiTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_origin_allowed`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        allowedOrigins: ["http://allowed.example.com"],
      });
      createdKeyIds.push(id);

      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`)
        .set("Origin", "http://allowed.example.com");

      expect(res.status).toBe(200);
    });

    it("should deny request from non-allowed origin", async () => {
      const prisma = getApiTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_origin_denied`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        allowedOrigins: ["http://allowed.example.com"],
      });
      createdKeyIds.push(id);

      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`)
        .set("Origin", "http://denied.example.com");

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error", "Forbidden");
      expect(res.body).toHaveProperty("message", "Origin not allowed");
    });

    it("should support multiple allowed origins", async () => {
      const prisma = getApiTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_multi_origin`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        allowedOrigins: [
          "http://first.example.com",
          "http://second.example.com",
        ],
      });
      createdKeyIds.push(id);

      // First origin
      const res1 = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`)
        .set("Origin", "http://first.example.com");

      expect(res1.status).toBe(200);

      // Second origin
      const res2 = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`)
        .set("Origin", "http://second.example.com");

      expect(res2.status).toBe(200);

      // Third origin (not allowed)
      const res3 = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`)
        .set("Origin", "http://third.example.com");

      expect(res3.status).toBe(403);
    });
  });

  describe("Expired API Keys", () => {
    it("should reject expired API key", async () => {
      const prisma = getApiTestPrisma();

      // Create key that expired yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_expired`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        expiresAt: yesterday,
      });
      createdKeyIds.push(id);

      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Unauthorized");
    });

    it("should accept non-expired API key", async () => {
      const prisma = getApiTestPrisma();

      // Create key that expires tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_not_expired`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        expiresAt: tomorrow,
      });
      createdKeyIds.push(id);

      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Revoked API Keys", () => {
    it("should reject revoked API key", async () => {
      const prisma = getApiTestPrisma();

      // Create and then revoke a key
      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_revoked`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
      });
      createdKeyIds.push(id);

      // Revoke the key
      await prisma.api_keys.update({
        where: { id },
        data: {
          is_active: false,
          revoked_at: new Date(),
          revoke_reason: "Test revocation",
        },
      });

      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Unauthorized");
    });
  });

  describe("Inactive API Keys", () => {
    it("should reject inactive API key", async () => {
      const prisma = getApiTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_inactive`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
      });
      createdKeyIds.push(id);

      // Deactivate the key
      await prisma.api_keys.update({
        where: { id },
        data: { is_active: false },
      });

      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`);

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Unauthorized");
    });
  });

  describe("Scope Validation", () => {
    it("should allow operation matching key scope", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should deny operation not matching key scope", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`)
        .send({ name: "Test", slug: "scope-test" });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error", "Forbidden");
    });

    it("should allow admin scope to perform any operation", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
    });
  });

  describe("Key Type Authorization", () => {
    it("should allow admin key to access any resource", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should restrict user key to owned resources", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      // User should only see their own sites
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("should restrict site key to specific site", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.siteApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(apiTestData.siteId);
    });

    it("should deny site key access to other sites", async () => {
      // Create another site
      const prisma = getApiTestPrisma();
      const otherSite = await prisma.sites.create({
        data: {
          name: "Other Site",
          slug: `${API_TEST_PREFIX}-other-site-key-test`,
          owner_id: apiTestData.userId!,
        },
      });

      const res = await request(app)
        .get(`/api/sites/${otherSite.id}`)
        .set("Authorization", `Bearer ${apiTestData.siteApiKey!.key}`);

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.sites.delete({ where: { id: otherSite.id } });
    });
  });

  describe("API Key Usage Recording", () => {
    it("should record API key usage after request", async () => {
      const prisma = getApiTestPrisma();

      // Get initial usage count
      const initialKey = await prisma.api_keys.findUnique({
        where: { id: apiTestData.userApiKey!.id },
      });
      const initialCount = Number(initialKey?.usage_count ?? 0);

      // Make a request
      await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      // Wait a bit for async usage recording
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check usage was recorded
      const updatedKey = await prisma.api_keys.findUnique({
        where: { id: apiTestData.userApiKey!.id },
      });

      expect(Number(updatedKey?.usage_count)).toBeGreaterThan(initialCount);
      expect(updatedKey?.last_used_at).not.toBeNull();
    });

    it("should record usage log entry", async () => {
      const prisma = getApiTestPrisma();

      // Make a request
      await request(app)
        .get("/api/health")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      // Wait for async recording
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check usage log exists
      const usageLog = await prisma.api_key_usage.findFirst({
        where: { api_key_id: apiTestData.userApiKey!.id },
        orderBy: { created_at: "desc" },
      });

      expect(usageLog).not.toBeNull();
      expect(usageLog?.method).toBe("GET");
      expect(usageLog?.status_code).toBe(200);
    });
  });

  describe("Authentication Header Formats", () => {
    it("should accept Bearer token format", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
    });

    it("should accept X-API-Key header", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("X-API-Key", apiTestData.userApiKey!.key);

      expect(res.status).toBe(200);
    });

    it("should reject malformed Bearer token", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", "Bearer"); // Missing actual token

      expect(res.status).toBe(401);
    });

    it("should reject non-Bearer Authorization scheme", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Basic ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(401);
    });

    it("should reject empty Authorization header", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", "");

      expect(res.status).toBe(401);
    });
  });

  describe("Combined Restrictions", () => {
    it("should enforce both IP and origin restrictions", async () => {
      const prisma = getApiTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${API_TEST_PREFIX}_combined_restrictions`,
        keyType: "user",
        userId: apiTestData.userId!,
        scopes: ["read"],
        allowedIps: ["127.0.0.1", "::1", "::ffff:127.0.0.1"],
        allowedOrigins: ["http://allowed.example.com"],
      });
      createdKeyIds.push(id);

      // Valid IP, valid origin - should succeed
      const res1 = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`)
        .set("Origin", "http://allowed.example.com");

      expect(res1.status).toBe(200);

      // Valid IP, invalid origin - should fail
      const res2 = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiKey.key}`)
        .set("Origin", "http://denied.example.com");

      expect(res2.status).toBe(403);
    });
  });
});
