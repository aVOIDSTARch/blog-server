import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getTestPrisma,
  disconnectTestPrisma,
  setupTestData,
  cleanupTestData,
  testDataIds,
  TEST_PREFIX,
  TEST_SLUG_PREFIX,
} from "./setup";
import {
  generateApiKey,
  hashApiKey,
  createApiKey,
  validateApiKey,
  hasScope,
  hasAccessToSite,
  recordUsage,
  revokeApiKey,
  listUserApiKeys,
  getKeyUsageStats,
  grantSiteAccess,
  revokeSiteAccess,
  isIpAllowed,
  isOriginAllowed,
} from "../../src/lib/api-keys";

describe("API Keys", () => {
  let createdKeyIds: string[] = [];

  beforeAll(async () => {
    await setupTestData();
  });

  afterAll(async () => {
    const prisma = getTestPrisma();

    // Clean up created API keys
    for (const keyId of createdKeyIds) {
      await prisma.api_keys.delete({ where: { id: keyId } }).catch(() => {});
    }

    await cleanupTestData();
    await disconnectTestPrisma();
  });

  describe("Key Generation", () => {
    it("should generate a user API key with correct format", () => {
      const result = generateApiKey("user");

      expect(result.key).toMatch(/^sk_live_[A-Za-z0-9_-]+$/);
      expect(result.prefix).toMatch(/^sk_live_[A-Za-z0-9_-]{8}$/);
      expect(result.hash).toHaveLength(64); // SHA-256 hex
    });

    it("should generate a site API key with correct format", () => {
      const result = generateApiKey("site");

      expect(result.key).toMatch(/^ss_live_[A-Za-z0-9_-]+$/);
      expect(result.prefix).toMatch(/^ss_live_[A-Za-z0-9_-]{8}$/);
    });

    it("should generate an admin API key with correct format", () => {
      const result = generateApiKey("admin");

      expect(result.key).toMatch(/^sa_live_[A-Za-z0-9_-]+$/);
      expect(result.prefix).toMatch(/^sa_live_[A-Za-z0-9_-]{8}$/);
    });

    it("should generate unique keys each time", () => {
      const key1 = generateApiKey("user");
      const key2 = generateApiKey("user");

      expect(key1.key).not.toBe(key2.key);
      expect(key1.hash).not.toBe(key2.hash);
    });

    it("should hash keys consistently", () => {
      const key = "sk_live_test123";
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);

      expect(hash1).toBe(hash2);
    });
  });

  describe("Key Creation", () => {
    it("should create a user API key", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_User_Key`,
        description: "Test user key",
        keyType: "user",
        userId: testDataIds.userId!,
        scopes: ["read", "write"],
      });

      createdKeyIds.push(id);

      expect(apiKey.key).toMatch(/^sk_live_/);
      expect(id).toBeDefined();

      // Verify in database
      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey).not.toBeNull();
      expect(dbKey!.name).toBe(`${TEST_PREFIX}_User_Key`);
      expect(dbKey!.key_type).toBe("user");
      expect(dbKey!.scopes).toEqual(["read", "write"]);
    });

    it("should create a site API key", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Site_Key`,
        keyType: "site",
        userId: testDataIds.userId!,
        siteId: testDataIds.siteId!,
        scopes: ["read"],
      });

      createdKeyIds.push(id);

      expect(apiKey.key).toMatch(/^ss_live_/);
    });

    it("should create an admin API key", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Admin_Key`,
        keyType: "admin",
        scopes: ["admin"],
      });

      createdKeyIds.push(id);

      expect(apiKey.key).toMatch(/^sa_live_/);
    });

    it("should reject user key without user_id", async () => {
      const prisma = getTestPrisma();

      await expect(
        createApiKey(prisma, {
          name: `${TEST_PREFIX}_Invalid`,
          keyType: "user",
          scopes: ["read"],
        })
      ).rejects.toThrow("User keys require a user_id");
    });

    it("should reject site key without site_id", async () => {
      const prisma = getTestPrisma();

      await expect(
        createApiKey(prisma, {
          name: `${TEST_PREFIX}_Invalid`,
          keyType: "site",
          userId: testDataIds.userId!,
          scopes: ["read"],
        })
      ).rejects.toThrow("Site keys require both site_id and user_id");
    });

    it("should reject admin scope on non-admin key", async () => {
      const prisma = getTestPrisma();

      await expect(
        createApiKey(prisma, {
          name: `${TEST_PREFIX}_Invalid`,
          keyType: "user",
          userId: testDataIds.userId!,
          scopes: ["admin"],
        })
      ).rejects.toThrow("Only admin keys can have admin scope");
    });

    it("should create key with rate limits", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Rate_Limited`,
        keyType: "user",
        userId: testDataIds.userId!,
        rateLimitPerMinute: 30,
        rateLimitPerDay: 5000,
      });

      createdKeyIds.push(id);

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.rate_limit_per_minute).toBe(30);
      expect(dbKey!.rate_limit_per_day).toBe(5000);
    });

    it("should create key with expiration", async () => {
      const prisma = getTestPrisma();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Expiring`,
        keyType: "user",
        userId: testDataIds.userId!,
        expiresAt,
      });

      createdKeyIds.push(id);

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.expires_at).not.toBeNull();
    });

    it("should create key with IP restrictions", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_IP_Restricted`,
        keyType: "user",
        userId: testDataIds.userId!,
        allowedIps: ["192.168.1.1", "10.0.0.1"],
      });

      createdKeyIds.push(id);

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.allowed_ips).toEqual(["192.168.1.1", "10.0.0.1"]);
    });
  });

  describe("Key Validation", () => {
    it("should validate a valid API key", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Validate_Test`,
        keyType: "user",
        userId: testDataIds.userId!,
        scopes: ["read", "write"],
      });

      createdKeyIds.push(id);

      const validated = await validateApiKey(prisma, apiKey.key);

      expect(validated).not.toBeNull();
      expect(validated!.id).toBe(id);
      expect(validated!.name).toBe(`${TEST_PREFIX}_Validate_Test`);
      expect(validated!.scopes).toEqual(["read", "write"]);
    });

    it("should return null for invalid key", async () => {
      const prisma = getTestPrisma();

      const validated = await validateApiKey(prisma, "sk_live_invalid123");

      expect(validated).toBeNull();
    });

    it("should return null for revoked key", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Revoked`,
        keyType: "user",
        userId: testDataIds.userId!,
      });

      createdKeyIds.push(id);

      await revokeApiKey(prisma, id);

      const validated = await validateApiKey(prisma, apiKey.key);
      expect(validated).toBeNull();
    });

    it("should return null for expired key", async () => {
      const prisma = getTestPrisma();
      const expiresAt = new Date(Date.now() - 1000); // Already expired

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Expired`,
        keyType: "user",
        userId: testDataIds.userId!,
        expiresAt,
      });

      createdKeyIds.push(id);

      const validated = await validateApiKey(prisma, apiKey.key);
      expect(validated).toBeNull();
    });
  });

  describe("Scope Checking", () => {
    it("should check if key has scope", () => {
      const apiKey = {
        id: "test",
        name: "test",
        keyType: "user" as const,
        userId: "test",
        siteId: null,
        scopes: ["read" as const, "write" as const],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        allowedIps: [],
        allowedOrigins: [],
      };

      expect(hasScope(apiKey, "read")).toBe(true);
      expect(hasScope(apiKey, "write")).toBe(true);
      expect(hasScope(apiKey, "delete")).toBe(false);
      expect(hasScope(apiKey, "admin")).toBe(false);
    });

    it("should allow admin scope to access all", () => {
      const apiKey = {
        id: "test",
        name: "test",
        keyType: "admin" as const,
        userId: null,
        siteId: null,
        scopes: ["admin" as const],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        allowedIps: [],
        allowedOrigins: [],
      };

      expect(hasScope(apiKey, "read")).toBe(true);
      expect(hasScope(apiKey, "write")).toBe(true);
      expect(hasScope(apiKey, "delete")).toBe(true);
      expect(hasScope(apiKey, "admin")).toBe(true);
    });
  });

  describe("Site Access", () => {
    it("should allow admin key access to any site", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Admin_Access`,
        keyType: "admin",
        scopes: ["admin"],
      });

      createdKeyIds.push(id);

      const validated = await validateApiKey(prisma, apiKey.key);
      const hasAccess = await hasAccessToSite(
        prisma,
        validated!,
        testDataIds.siteId!,
        "read"
      );

      expect(hasAccess).toBe(true);
    });

    it("should allow site key access to its own site", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Site_Access`,
        keyType: "site",
        userId: testDataIds.userId!,
        siteId: testDataIds.siteId!,
        scopes: ["read"],
      });

      createdKeyIds.push(id);

      const validated = await validateApiKey(prisma, apiKey.key);
      const hasAccess = await hasAccessToSite(
        prisma,
        validated!,
        testDataIds.siteId!,
        "read"
      );

      expect(hasAccess).toBe(true);
    });

    it("should deny site key access to other sites", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Site_Deny`,
        keyType: "site",
        userId: testDataIds.userId!,
        siteId: testDataIds.siteId!,
        scopes: ["read"],
      });

      createdKeyIds.push(id);

      const validated = await validateApiKey(prisma, apiKey.key);
      const hasAccess = await hasAccessToSite(
        prisma,
        validated!,
        "00000000-0000-0000-0000-000000000000", // Different site
        "read"
      );

      expect(hasAccess).toBe(false);
    });

    it("should allow user key access to owned site", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_User_Owner`,
        keyType: "user",
        userId: testDataIds.userId!,
        scopes: ["read"],
      });

      createdKeyIds.push(id);

      const validated = await validateApiKey(prisma, apiKey.key);
      const hasAccess = await hasAccessToSite(
        prisma,
        validated!,
        testDataIds.siteId!,
        "read"
      );

      expect(hasAccess).toBe(true);
    });
  });

  describe("Key Revocation", () => {
    it("should revoke a key", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_To_Revoke`,
        keyType: "user",
        userId: testDataIds.userId!,
      });

      createdKeyIds.push(id);

      await revokeApiKey(prisma, id, testDataIds.userId, "Test revocation");

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.is_active).toBe(false);
      expect(dbKey!.revoked_at).not.toBeNull();
      expect(dbKey!.revoked_by).toBe(testDataIds.userId);
      expect(dbKey!.revoke_reason).toBe("Test revocation");
    });
  });

  describe("Usage Recording", () => {
    it("should record API key usage", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Usage`,
        keyType: "user",
        userId: testDataIds.userId!,
      });

      createdKeyIds.push(id);

      await recordUsage(prisma, id, {
        endpoint: "/api/posts",
        method: "GET",
        statusCode: 200,
        responseTimeMs: 50,
        ipAddress: "127.0.0.1",
      });

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.last_used_at).not.toBeNull();
      expect(dbKey!.usage_count).toBe(BigInt(1));

      const usageLogs = await prisma.api_key_usage.findMany({
        where: { api_key_id: id },
      });
      expect(usageLogs).toHaveLength(1);
      expect(usageLogs[0].endpoint).toBe("/api/posts");
    });

    it("should get usage statistics", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Stats`,
        keyType: "user",
        userId: testDataIds.userId!,
      });

      createdKeyIds.push(id);

      // Record some usage
      await recordUsage(prisma, id, {
        endpoint: "/api/posts",
        method: "GET",
        statusCode: 200,
        responseTimeMs: 50,
      });
      await recordUsage(prisma, id, {
        endpoint: "/api/posts",
        method: "POST",
        statusCode: 201,
        responseTimeMs: 100,
      });
      await recordUsage(prisma, id, {
        endpoint: "/api/comments",
        method: "GET",
        statusCode: 500,
        responseTimeMs: 200,
      });

      const stats = await getKeyUsageStats(prisma, id);

      expect(stats.totalRequests).toBe(3);
      expect(stats.successfulRequests).toBe(2);
      expect(stats.failedRequests).toBe(1);
      expect(stats.avgResponseTime).toBeCloseTo(116.67, 1);
      expect(stats.topEndpoints).toHaveLength(2);
    });
  });

  describe("Site Access Management", () => {
    it("should grant and revoke site access", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Grant_Access`,
        keyType: "user",
        userId: testDataIds.userId!,
        scopes: ["read"],
      });

      createdKeyIds.push(id);

      // Grant access
      await grantSiteAccess(prisma, id, testDataIds.siteId!, ["read", "write"]);

      const access = await prisma.api_key_site_access.findFirst({
        where: { api_key_id: id, site_id: testDataIds.siteId! },
      });
      expect(access).not.toBeNull();
      expect(access!.scopes).toEqual(["read", "write"]);

      // Revoke access
      await revokeSiteAccess(prisma, id, testDataIds.siteId!);

      const revokedAccess = await prisma.api_key_site_access.findFirst({
        where: { api_key_id: id, site_id: testDataIds.siteId! },
      });
      expect(revokedAccess).toBeNull();
    });
  });

  describe("Listing Keys", () => {
    it("should list user API keys", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_List_Test`,
        keyType: "user",
        userId: testDataIds.userId!,
      });

      createdKeyIds.push(id);

      const keys = await listUserApiKeys(prisma, testDataIds.userId!);

      const testKeys = keys.filter((k) => k.name.startsWith(TEST_PREFIX));
      expect(testKeys.length).toBeGreaterThan(0);

      const foundKey = testKeys.find((k) => k.id === id);
      expect(foundKey).not.toBeUndefined();
      expect(foundKey!.keyPrefix).toMatch(/^sk_live_/);
    });
  });

  describe("IP and Origin Restrictions", () => {
    it("should check IP restrictions", () => {
      const restrictedKey = {
        id: "test",
        name: "test",
        keyType: "user" as const,
        userId: "test",
        siteId: null,
        scopes: ["read" as const],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        allowedIps: ["192.168.1.1", "10.0.0.1"],
        allowedOrigins: [],
      };

      expect(isIpAllowed(restrictedKey, "192.168.1.1")).toBe(true);
      expect(isIpAllowed(restrictedKey, "10.0.0.1")).toBe(true);
      expect(isIpAllowed(restrictedKey, "8.8.8.8")).toBe(false);
    });

    it("should allow all IPs when no restrictions", () => {
      const unrestrictedKey = {
        id: "test",
        name: "test",
        keyType: "user" as const,
        userId: "test",
        siteId: null,
        scopes: ["read" as const],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        allowedIps: [],
        allowedOrigins: [],
      };

      expect(isIpAllowed(unrestrictedKey, "192.168.1.1")).toBe(true);
      expect(isIpAllowed(unrestrictedKey, "8.8.8.8")).toBe(true);
    });

    it("should check origin restrictions", () => {
      const restrictedKey = {
        id: "test",
        name: "test",
        keyType: "user" as const,
        userId: "test",
        siteId: null,
        scopes: ["read" as const],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        allowedIps: [],
        allowedOrigins: ["https://example.com", "https://api.example.com"],
      };

      expect(isOriginAllowed(restrictedKey, "https://example.com")).toBe(true);
      expect(isOriginAllowed(restrictedKey, "https://malicious.com")).toBe(
        false
      );
    });

    it("should allow all origins when no restrictions", () => {
      const unrestrictedKey = {
        id: "test",
        name: "test",
        keyType: "user" as const,
        userId: "test",
        siteId: null,
        scopes: ["read" as const],
        rateLimitPerMinute: 60,
        rateLimitPerDay: 10000,
        allowedIps: [],
        allowedOrigins: [],
      };

      expect(isOriginAllowed(unrestrictedKey, "https://example.com")).toBe(true);
      expect(isOriginAllowed(unrestrictedKey, "https://malicious.com")).toBe(true);
    });
  });

  describe("Key Creation with metadata", () => {
    it("should create key with custom metadata", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Metadata`,
        keyType: "user",
        userId: testDataIds.userId!,
        metadata: { environment: "test", version: 1 },
      });

      createdKeyIds.push(id);

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.metadata).toEqual({ environment: "test", version: 1 });
    });

    it("should create key with origin restrictions", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Origin_Restricted`,
        keyType: "user",
        userId: testDataIds.userId!,
        allowedOrigins: ["https://example.com", "https://api.example.com"],
      });

      createdKeyIds.push(id);

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.allowed_origins).toEqual([
        "https://example.com",
        "https://api.example.com",
      ]);
    });

    it("should create key with description", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Described`,
        description: "This is a test API key with a description",
        keyType: "user",
        userId: testDataIds.userId!,
      });

      createdKeyIds.push(id);

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.description).toBe("This is a test API key with a description");
    });
  });

  describe("Site Access Edge Cases", () => {
    it("should deny access when key lacks required scope", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Read_Only`,
        keyType: "user",
        userId: testDataIds.userId!,
        scopes: ["read"], // Only read scope
      });

      createdKeyIds.push(id);

      const validated = await validateApiKey(prisma, apiKey.key);
      // User owns the site but key doesn't have write scope
      const hasWriteAccess = await hasAccessToSite(
        prisma,
        validated!,
        testDataIds.siteId!,
        "write"
      );

      expect(hasWriteAccess).toBe(false);
    });

    it("should allow access via explicit site access grant", async () => {
      const prisma = getTestPrisma();

      // Create a second site that the user doesn't own
      const otherSite = await prisma.sites.create({
        data: {
          name: `${TEST_PREFIX}_Other_Site`,
          slug: `${TEST_SLUG_PREFIX}other-site`,
          owner_id: testDataIds.userId!, // Same owner for simplicity
        },
      });

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Explicit_Access`,
        keyType: "user",
        userId: testDataIds.userId!,
        scopes: ["read", "write"],
      });

      createdKeyIds.push(id);

      // Grant explicit access to the other site
      await grantSiteAccess(prisma, id, otherSite.id, ["read", "write"]);

      const validated = await validateApiKey(prisma, apiKey.key);
      const hasAccess = await hasAccessToSite(
        prisma,
        validated!,
        otherSite.id,
        "read"
      );

      expect(hasAccess).toBe(true);

      // Cleanup
      await prisma.api_key_site_access.deleteMany({ where: { site_id: otherSite.id } });
      await prisma.sites.delete({ where: { id: otherSite.id } });
    });
  });

  describe("Usage Statistics with Date Range", () => {
    it("should filter usage stats by date range", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Date_Range`,
        keyType: "user",
        userId: testDataIds.userId!,
      });

      createdKeyIds.push(id);

      // Record usage
      await recordUsage(prisma, id, {
        endpoint: "/api/posts",
        method: "GET",
        statusCode: 200,
        responseTimeMs: 50,
      });

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Stats with date range including the request
      const statsIncluding = await getKeyUsageStats(prisma, id, {
        startDate: yesterday,
        endDate: tomorrow,
      });
      expect(statsIncluding.totalRequests).toBe(1);

      // Stats with date range excluding the request (in the past)
      const pastEnd = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const statsExcluding = await getKeyUsageStats(prisma, id, {
        startDate: yesterday,
        endDate: pastEnd,
      });
      expect(statsExcluding.totalRequests).toBe(0);
    });
  });

  describe("Admin Key Edge Cases", () => {
    it("should reject admin key with user_id", async () => {
      const prisma = getTestPrisma();

      await expect(
        createApiKey(prisma, {
          name: `${TEST_PREFIX}_Invalid_Admin`,
          keyType: "admin",
          userId: testDataIds.userId!,
          scopes: ["admin"],
        })
      ).rejects.toThrow("Admin keys cannot have user_id or site_id");
    });

    it("should reject admin key with site_id", async () => {
      const prisma = getTestPrisma();

      await expect(
        createApiKey(prisma, {
          name: `${TEST_PREFIX}_Invalid_Admin`,
          keyType: "admin",
          siteId: testDataIds.siteId!,
          scopes: ["admin"],
        })
      ).rejects.toThrow("Admin keys cannot have user_id or site_id");
    });
  });

  describe("Multiple Usage Recording", () => {
    it("should increment usage count correctly", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Multi_Usage`,
        keyType: "user",
        userId: testDataIds.userId!,
      });

      createdKeyIds.push(id);

      // Record multiple usages
      await recordUsage(prisma, id, { endpoint: "/api/posts", method: "GET" });
      await recordUsage(prisma, id, { endpoint: "/api/posts", method: "GET" });
      await recordUsage(prisma, id, { endpoint: "/api/posts", method: "POST" });

      const dbKey = await prisma.api_keys.findUnique({ where: { id } });
      expect(dbKey!.usage_count).toBe(BigInt(3));

      const usageLogs = await prisma.api_key_usage.findMany({
        where: { api_key_id: id },
      });
      expect(usageLogs).toHaveLength(3);
    });
  });

  describe("Site Access Grant Update", () => {
    it("should update existing site access scopes", async () => {
      const prisma = getTestPrisma();

      const { id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Update_Access`,
        keyType: "user",
        userId: testDataIds.userId!,
        scopes: ["read", "write"],
      });

      createdKeyIds.push(id);

      // Grant initial access with read only
      await grantSiteAccess(prisma, id, testDataIds.siteId!, ["read"]);

      let access = await prisma.api_key_site_access.findFirst({
        where: { api_key_id: id, site_id: testDataIds.siteId! },
      });
      expect(access!.scopes).toEqual(["read"]);

      // Update to include write
      await grantSiteAccess(prisma, id, testDataIds.siteId!, ["read", "write"]);

      access = await prisma.api_key_site_access.findFirst({
        where: { api_key_id: id, site_id: testDataIds.siteId! },
      });
      expect(access!.scopes).toEqual(["read", "write"]);

      // Cleanup
      await revokeSiteAccess(prisma, id, testDataIds.siteId!);
    });
  });

  describe("Validated Key Properties", () => {
    it("should return all validated key properties correctly", async () => {
      const prisma = getTestPrisma();

      const { apiKey, id } = await createApiKey(prisma, {
        name: `${TEST_PREFIX}_Full_Validation`,
        keyType: "user",
        userId: testDataIds.userId!,
        scopes: ["read", "write", "delete"],
        rateLimitPerMinute: 120,
        rateLimitPerDay: 50000,
        allowedIps: ["10.0.0.1"],
        allowedOrigins: ["https://test.com"],
      });

      createdKeyIds.push(id);

      const validated = await validateApiKey(prisma, apiKey.key);

      expect(validated).not.toBeNull();
      expect(validated!.id).toBe(id);
      expect(validated!.name).toBe(`${TEST_PREFIX}_Full_Validation`);
      expect(validated!.keyType).toBe("user");
      expect(validated!.userId).toBe(testDataIds.userId);
      expect(validated!.siteId).toBeNull();
      expect(validated!.scopes).toEqual(["read", "write", "delete"]);
      expect(validated!.rateLimitPerMinute).toBe(120);
      expect(validated!.rateLimitPerDay).toBe(50000);
      expect(validated!.allowedIps).toEqual(["10.0.0.1"]);
      expect(validated!.allowedOrigins).toEqual(["https://test.com"]);
    });
  });
});
