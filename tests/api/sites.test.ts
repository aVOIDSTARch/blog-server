import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import {
  getApiTestPrisma,
  disconnectApiTestPrisma,
  setupApiTestData,
  cleanupApiTestData,
  createTestApp,
  apiTestData,
  API_TEST_SLUG_PREFIX,
} from "./setup";

describe("Sites API", () => {
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

  describe("GET /api/sites", () => {
    it("should list all sites for admin", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("count");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should list only user's sites for user key", async () => {
      const res = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      // Should include the test site owned by the user
      const testSite = res.body.data.find((s: any) => s.id === apiTestData.siteId);
      expect(testSite).toBeDefined();
    });

    it("should filter sites by status", async () => {
      const res = await request(app)
        .get("/api/sites?status=active")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
    });
  });

  describe("GET /api/sites/:siteId", () => {
    it("should get a specific site by ID", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("id", apiTestData.siteId);
      expect(res.body.data).toHaveProperty("name");
      expect(res.body.data).toHaveProperty("slug");
    });

    it("should return 404 for non-existent site", async () => {
      const res = await request(app)
        .get("/api/sites/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Site not found");
    });

    it("should deny access to site for site key of different site", async () => {
      // Create a second site
      const prisma = getApiTestPrisma();
      const otherSite = await prisma.sites.create({
        data: {
          name: "Other Site",
          slug: `${API_TEST_SLUG_PREFIX}other`,
          owner_id: apiTestData.userId!,
        },
      });

      // Site key for first site should not access second site
      const res = await request(app)
        .get(`/api/sites/${otherSite.id}`)
        .set("Authorization", `Bearer ${apiTestData.siteApiKey!.key}`);

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.sites.delete({ where: { id: otherSite.id } });
    });
  });

  describe("POST /api/sites", () => {
    it("should create a new site", async () => {
      const newSite = {
        name: "New Test Site",
        slug: `${API_TEST_SLUG_PREFIX}new-site`,
        description: "A new test site",
      };

      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send(newSite);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("name", newSite.name);
      expect(res.body.data).toHaveProperty("slug", newSite.slug);

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.sites.delete({ where: { id: res.body.data.id } });
    });

    it("should reject site creation without required fields", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ description: "Missing name and slug" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Bad Request");
    });

    it("should reject duplicate site slugs", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Duplicate Site",
          slug: `${API_TEST_SLUG_PREFIX}site`, // Already exists
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty("error", "Conflict");
    });

    it("should deny site creation with read-only key", async () => {
      const res = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`)
        .send({
          name: "Should Fail",
          slug: `${API_TEST_SLUG_PREFIX}should-fail`,
        });

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/sites/:siteId", () => {
    it("should update a site", async () => {
      const res = await request(app)
        .patch(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ description: "Updated description" });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("description", "Updated description");
    });

    it("should deny update to site not owned by user", async () => {
      // Create another user and site
      const prisma = getApiTestPrisma();
      const otherUserId = "11111111-1111-1111-1111-111111111111";

      await prisma.auth_users.create({
        data: {
          id: otherUserId,
          instance_id: "00000000-0000-0000-0000-000000000000",
          aud: "authenticated",
          role: "authenticated",
          email: `${API_TEST_SLUG_PREFIX}other@test.local`,
          encrypted_password: "$2a$10$placeholder",
          email_confirmed_at: new Date(),
          raw_app_meta_data: {},
          raw_user_meta_data: { username: `${API_TEST_SLUG_PREFIX}other` },
          created_at: new Date(),
          updated_at: new Date(),
          confirmation_token: "",
          recovery_token: "",
          email_change_token_new: "",
          email_change: "",
        },
      });

      const otherSite = await prisma.sites.create({
        data: {
          name: "Other User Site",
          slug: `${API_TEST_SLUG_PREFIX}other-user-site`,
          owner_id: otherUserId,
        },
      });

      const res = await request(app)
        .patch(`/api/sites/${otherSite.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ description: "Should not update" });

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.sites.delete({ where: { id: otherSite.id } });
      await prisma.public_users.delete({ where: { id: otherUserId } }).catch(() => {});
      await prisma.auth_users.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it("should allow admin to update any site", async () => {
      const res = await request(app)
        .patch(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({ tagline: "Admin updated tagline" });

      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/sites/:siteId", () => {
    it("should delete a site (admin only)", async () => {
      // Create a site to delete
      const prisma = getApiTestPrisma();
      const siteToDelete = await prisma.sites.create({
        data: {
          name: "Site To Delete",
          slug: `${API_TEST_SLUG_PREFIX}to-delete`,
          owner_id: apiTestData.userId!,
        },
      });

      // Delete requires admin key
      const res = await request(app)
        .delete(`/api/sites/${siteToDelete.id}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(204);

      // Verify deletion
      const deleted = await prisma.sites.findUnique({
        where: { id: siteToDelete.id },
      });
      expect(deleted).toBeNull();
    });

    it("should deny deletion with non-admin key", async () => {
      const res = await request(app)
        .delete(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(403);
    });

    it("should deny deletion with read-only key", async () => {
      const res = await request(app)
        .delete(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/sites/:siteId/stats", () => {
    it("should get site statistics", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/stats`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("posts");
      expect(res.body.data).toHaveProperty("categories");
      expect(res.body.data).toHaveProperty("tags");
    });
  });
});
