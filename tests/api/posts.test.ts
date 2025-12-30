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
  API_TEST_PREFIX,
} from "./setup";

describe("Posts API", () => {
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

  describe("GET /api/sites/:siteId/posts", () => {
    it("should list posts for a site", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should paginate posts", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/posts?limit=5&page=1`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body.pagination).toHaveProperty("limit", 5);
      expect(res.body.pagination).toHaveProperty("page", 1);
      expect(res.body.pagination).toHaveProperty("total");
    });

    it("should filter posts by status", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/posts?status=published`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      // All returned posts should be published
      for (const post of res.body.data) {
        expect(post.status).toBe("published");
      }
    });

    it("should filter posts by author", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/posts?author_id=${apiTestData.userId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      for (const post of res.body.data) {
        expect(post.author_id).toBe(apiTestData.userId);
      }
    });

    it("should deny access with site key for different site", async () => {
      // Create another site
      const prisma = getApiTestPrisma();
      const otherSite = await prisma.sites.create({
        data: {
          name: "Other Site for Posts",
          slug: `${API_TEST_SLUG_PREFIX}other-posts`,
          owner_id: apiTestData.userId!,
        },
      });

      const res = await request(app)
        .get(`/api/sites/${otherSite.id}/posts`)
        .set("Authorization", `Bearer ${apiTestData.siteApiKey!.key}`);

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.sites.delete({ where: { id: otherSite.id } });
    });
  });

  describe("GET /api/posts/:postId", () => {
    it("should get a specific post by ID", async () => {
      const res = await request(app)
        .get(`/api/posts/${apiTestData.postId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("id", apiTestData.postId);
      expect(res.body.data).toHaveProperty("title");
      expect(res.body.data).toHaveProperty("content");
      expect(res.body.data).toHaveProperty("author");
    });

    it("should return 404 for non-existent post", async () => {
      const res = await request(app)
        .get("/api/posts/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Post not found");
    });
  });

  describe("POST /api/sites/:siteId/posts", () => {
    it("should create a new post", async () => {
      const newPost = {
        title: "New Test Post",
        slug: `${API_TEST_SLUG_PREFIX}new-post`,
        content: "# New Post\n\nThis is new content",
        content_format: "markdown",
        status: "draft",
      };

      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send(newPost);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("title", newPost.title);
      expect(res.body.data).toHaveProperty("slug", newPost.slug);
      expect(res.body.data).toHaveProperty("status", "draft");

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.posts.delete({ where: { id: res.body.data.id } });
    });

    it("should reject post creation without required fields", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ content: "Content without title or slug" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Bad Request");
    });

    it("should reject duplicate post slugs within same site", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          title: "Duplicate Post",
          slug: `${API_TEST_SLUG_PREFIX}post`, // Already exists
          content: "Content",
        });

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty("error", "Conflict");
    });

    it("should deny post creation with read-only key", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`)
        .send({
          title: "Should Fail",
          slug: `${API_TEST_SLUG_PREFIX}should-fail`,
          content: "Should not be created",
        });

      expect(res.status).toBe(403);
    });

    it("should create post with categories and tags", async () => {
      const newPost = {
        title: "Post With Relations",
        slug: `${API_TEST_SLUG_PREFIX}with-relations`,
        content: "Content with categories and tags",
        category_ids: [apiTestData.categoryId],
        tag_ids: [apiTestData.tagId],
      };

      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send(newPost);

      expect(res.status).toBe(201);

      // Verify relationships were created
      const prisma = getApiTestPrisma();
      const postWithRelations = await prisma.posts.findUnique({
        where: { id: res.body.data.id },
        include: { post_categories: true, post_tags: true },
      });

      expect(postWithRelations?.post_categories.length).toBe(1);
      expect(postWithRelations?.post_tags.length).toBe(1);

      // Cleanup
      await prisma.post_tags.deleteMany({ where: { post_id: res.body.data.id } });
      await prisma.post_categories.deleteMany({ where: { post_id: res.body.data.id } });
      await prisma.posts.delete({ where: { id: res.body.data.id } });
    });
  });

  describe("PATCH /api/posts/:postId", () => {
    it("should update a post", async () => {
      const res = await request(app)
        .patch(`/api/posts/${apiTestData.postId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ title: "Updated Title", description: "Updated description" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("title", "Updated Title");
      expect(res.body.data).toHaveProperty("description", "Updated description");
    });

    it("should update post status", async () => {
      const res = await request(app)
        .patch(`/api/posts/${apiTestData.postId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ status: "draft" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("status", "draft");
    });

    it("should deny update for post on site user does not have access to", async () => {
      // Create another user and site
      const prisma = getApiTestPrisma();
      const otherUserId = "22222222-2222-2222-2222-222222222222";

      await prisma.auth_users.create({
        data: {
          id: otherUserId,
          instance_id: "00000000-0000-0000-0000-000000000000",
          aud: "authenticated",
          role: "authenticated",
          email: `${API_TEST_PREFIX}other2@test.local`,
          encrypted_password: "$2a$10$placeholder",
          email_confirmed_at: new Date(),
          raw_app_meta_data: {},
          raw_user_meta_data: { username: `${API_TEST_SLUG_PREFIX}other2` },
          created_at: new Date(),
          updated_at: new Date(),
          confirmation_token: "",
          recovery_token: "",
          email_change_token_new: "",
          email_change: "",
        },
      });

      // Create a site owned by the other user
      const otherSite = await prisma.sites.create({
        data: {
          name: "Other User Site",
          slug: `${API_TEST_SLUG_PREFIX}other-user-site`,
          owner_id: otherUserId,
        },
      });

      const otherPost = await prisma.posts.create({
        data: {
          title: "Other User Post",
          slug: `${API_TEST_SLUG_PREFIX}other-user-post`,
          content: "Other user content",
          author_id: otherUserId,
          site_id: otherSite.id,
        },
      });

      const res = await request(app)
        .patch(`/api/posts/${otherPost.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ title: "Should not update" });

      expect(res.status).toBe(403);

      // Cleanup
      await prisma.posts.delete({ where: { id: otherPost.id } });
      await prisma.sites.delete({ where: { id: otherSite.id } });
      await prisma.public_users.delete({ where: { id: otherUserId } }).catch(() => {});
      await prisma.auth_users.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it("should allow site owner to update any post on their site", async () => {
      // Create a post by another author on the test user's site
      const prisma = getApiTestPrisma();
      const otherAuthorId = "33333333-3333-3333-3333-333333333333";

      await prisma.auth_users.create({
        data: {
          id: otherAuthorId,
          instance_id: "00000000-0000-0000-0000-000000000000",
          aud: "authenticated",
          role: "authenticated",
          email: `${API_TEST_PREFIX}author@test.local`,
          encrypted_password: "$2a$10$placeholder",
          email_confirmed_at: new Date(),
          raw_app_meta_data: {},
          raw_user_meta_data: { username: `${API_TEST_SLUG_PREFIX}author` },
          created_at: new Date(),
          updated_at: new Date(),
          confirmation_token: "",
          recovery_token: "",
          email_change_token_new: "",
          email_change: "",
        },
      });

      const otherAuthorPost = await prisma.posts.create({
        data: {
          title: "Other Author Post",
          slug: `${API_TEST_SLUG_PREFIX}other-author-post`,
          content: "Content by another author",
          author_id: otherAuthorId,
          site_id: apiTestData.siteId!, // On the test user's site
        },
      });

      // Site owner should be able to update any post on their site
      const res = await request(app)
        .patch(`/api/posts/${otherAuthorPost.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ title: "Updated by site owner" });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe("Updated by site owner");

      // Cleanup
      await prisma.posts.delete({ where: { id: otherAuthorPost.id } });
      await prisma.public_users.delete({ where: { id: otherAuthorId } }).catch(() => {});
      await prisma.auth_users.delete({ where: { id: otherAuthorId } }).catch(() => {});
    });
  });

  describe("DELETE /api/posts/:postId", () => {
    it("should delete a post", async () => {
      // Create a post to delete
      const prisma = getApiTestPrisma();
      const postToDelete = await prisma.posts.create({
        data: {
          title: "Post To Delete",
          slug: `${API_TEST_SLUG_PREFIX}to-delete-post`,
          content: "This will be deleted",
          author_id: apiTestData.userId!,
          site_id: apiTestData.siteId!,
        },
      });

      const res = await request(app)
        .delete(`/api/posts/${postToDelete.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(204);

      // Verify deletion
      const deleted = await prisma.posts.findUnique({
        where: { id: postToDelete.id },
      });
      expect(deleted).toBeNull();
    });

    it("should deny deletion with read-only key", async () => {
      const res = await request(app)
        .delete(`/api/posts/${apiTestData.postId}`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`);

      expect(res.status).toBe(403);
    });
  });
});
