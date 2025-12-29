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
  API_TEST_USERNAME_PREFIX,
} from "./setup";

describe("Users API", () => {
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

  describe("GET /api/users", () => {
    it("should list all users for admin", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should deny user listing for non-admin keys", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error", "Forbidden");
    });

    it("should search users by username", async () => {
      const res = await request(app)
        .get(`/api/users?search=${API_TEST_USERNAME_PREFIX}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/users/me", () => {
    it("should get current user profile", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("id", apiTestData.userId);
      expect(res.body.data).toHaveProperty("username");
      expect(res.body.data).toHaveProperty("display_name");
    });

    it("should return 400 for admin keys without user", async () => {
      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Bad Request");
    });
  });

  describe("GET /api/users/:userId", () => {
    it("should get a specific user by ID", async () => {
      const res = await request(app)
        .get(`/api/users/${apiTestData.userId}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("id", apiTestData.userId);
    });

    it("should allow user to get their own profile", async () => {
      const res = await request(app)
        .get(`/api/users/${apiTestData.userId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("id", apiTestData.userId);
    });

    it("should deny user from getting other users' profiles", async () => {
      // Create another user
      const prisma = getApiTestPrisma();
      const otherUserId = "33333333-3333-3333-3333-333333333333";

      await prisma.auth_users.create({
        data: {
          id: otherUserId,
          instance_id: "00000000-0000-0000-0000-000000000000",
          aud: "authenticated",
          role: "authenticated",
          email: `${API_TEST_PREFIX}other3@test.local`,
          encrypted_password: "$2a$10$placeholder",
          email_confirmed_at: new Date(),
          raw_app_meta_data: {},
          raw_user_meta_data: { username: `${API_TEST_USERNAME_PREFIX}other3` },
          created_at: new Date(),
          updated_at: new Date(),
          confirmation_token: "",
          recovery_token: "",
          email_change_token_new: "",
          email_change: "",
        },
      });

      const res = await request(app)
        .get(`/api/users/${otherUserId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.public_users.delete({ where: { id: otherUserId } }).catch(() => {});
      await prisma.auth_users.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it("should return 404 for non-existent user", async () => {
      const res = await request(app)
        .get("/api/users/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "User not found");
    });
  });

  describe("PATCH /api/users/:userId", () => {
    it("should update user profile", async () => {
      const res = await request(app)
        .patch(`/api/users/${apiTestData.userId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ bio: "Updated bio via API test" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("bio", "Updated bio via API test");
    });

    it("should update display name", async () => {
      const res = await request(app)
        .patch(`/api/users/${apiTestData.userId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ display_name: "Updated Display Name" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("display_name", "Updated Display Name");
    });

    it("should deny updating other users' profiles", async () => {
      // Create another user
      const prisma = getApiTestPrisma();
      const otherUserId = "44444444-4444-4444-4444-444444444444";

      await prisma.auth_users.create({
        data: {
          id: otherUserId,
          instance_id: "00000000-0000-0000-0000-000000000000",
          aud: "authenticated",
          role: "authenticated",
          email: `${API_TEST_PREFIX}other4@test.local`,
          encrypted_password: "$2a$10$placeholder",
          email_confirmed_at: new Date(),
          raw_app_meta_data: {},
          raw_user_meta_data: { username: `${API_TEST_USERNAME_PREFIX}other4` },
          created_at: new Date(),
          updated_at: new Date(),
          confirmation_token: "",
          recovery_token: "",
          email_change_token_new: "",
          email_change: "",
        },
      });

      const res = await request(app)
        .patch(`/api/users/${otherUserId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ bio: "Should not update" });

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.public_users.delete({ where: { id: otherUserId } }).catch(() => {});
      await prisma.auth_users.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it("should allow admin to update any user", async () => {
      const res = await request(app)
        .patch(`/api/users/${apiTestData.userId}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({ website: "https://admin-updated.example.com" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("website", "https://admin-updated.example.com");
    });

    it("should deny profile update with read-only key", async () => {
      const res = await request(app)
        .patch(`/api/users/${apiTestData.userId}`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`)
        .send({ bio: "Should not update" });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/users/:userId", () => {
    it("should deny user deletion for non-admin", async () => {
      const res = await request(app)
        .delete(`/api/users/${apiTestData.userId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(403);
    });

    it("should allow admin to delete users", async () => {
      // Create a user to delete
      const prisma = getApiTestPrisma();
      const userToDeleteId = "55555555-5555-5555-5555-555555555555";

      await prisma.auth_users.create({
        data: {
          id: userToDeleteId,
          instance_id: "00000000-0000-0000-0000-000000000000",
          aud: "authenticated",
          role: "authenticated",
          email: `${API_TEST_PREFIX}todelete@test.local`,
          encrypted_password: "$2a$10$placeholder",
          email_confirmed_at: new Date(),
          raw_app_meta_data: {},
          raw_user_meta_data: { username: `${API_TEST_USERNAME_PREFIX}todelete` },
          created_at: new Date(),
          updated_at: new Date(),
          confirmation_token: "",
          recovery_token: "",
          email_change_token_new: "",
          email_change: "",
        },
      });

      const res = await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(res.status).toBe(204);

      // Verify deletion
      const deleted = await prisma.public_users.findUnique({
        where: { id: userToDeleteId },
      });
      expect(deleted).toBeNull();

      // Cleanup auth user if still exists
      await prisma.auth_users.delete({ where: { id: userToDeleteId } }).catch(() => {});
    });
  });
});
