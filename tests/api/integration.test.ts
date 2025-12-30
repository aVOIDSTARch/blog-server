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
  API_TEST_SLUG_PREFIX,
} from "./setup";

describe("API Integration Tests", () => {
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

  describe("Complete Blog Post Workflow", () => {
    let workflowCategoryId: string;
    let workflowTagId: string;
    let workflowPostId: string;

    afterAll(async () => {
      const prisma = getApiTestPrisma();
      // Cleanup in reverse order
      if (workflowPostId) {
        await prisma.post_categories
          .deleteMany({ where: { post_id: workflowPostId } })
          .catch(() => {});
        await prisma.post_tags
          .deleteMany({ where: { post_id: workflowPostId } })
          .catch(() => {});
        await prisma.posts
          .delete({ where: { id: workflowPostId } })
          .catch(() => {});
      }
      if (workflowCategoryId) {
        await prisma.categories
          .delete({ where: { id: workflowCategoryId } })
          .catch(() => {});
      }
      if (workflowTagId) {
        await prisma.tags
          .delete({ where: { id: workflowTagId } })
          .catch(() => {});
      }
    });

    it("should complete full blog post creation workflow", async () => {
      // Step 1: Create a category
      const categoryRes = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Workflow Test Category",
          slug: `${API_TEST_SLUG_PREFIX}workflow-category`,
          description: "Category for workflow test",
        });

      expect(categoryRes.status).toBe(201);
      workflowCategoryId = categoryRes.body.data.id;

      // Step 2: Create a tag
      const tagRes = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Workflow Test Tag",
          slug: `${API_TEST_SLUG_PREFIX}workflow-tag`,
        });

      expect(tagRes.status).toBe(201);
      workflowTagId = tagRes.body.data.id;

      // Step 3: Create a post with the category and tag
      const postRes = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          title: "Workflow Test Post",
          slug: `${API_TEST_SLUG_PREFIX}workflow-post`,
          content: "This is the content of the workflow test post.",
          status: "draft",
          category_ids: [workflowCategoryId],
          tag_ids: [workflowTagId],
        });

      expect(postRes.status).toBe(201);
      workflowPostId = postRes.body.data.id;

      // Step 4: Update the post to published
      const updateRes = await request(app)
        .patch(`/api/posts/${workflowPostId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ status: "published" });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.status).toBe("published");

      // Step 5: Verify the post appears in published posts list
      const listRes = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/posts?status=published`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(listRes.status).toBe(200);
      const foundPost = listRes.body.data.find(
        (p: any) => p.id === workflowPostId
      );
      expect(foundPost).toBeDefined();
      expect(foundPost.status).toBe("published");

      // Step 6: Verify category has the post count updated
      const categoriesRes = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(categoriesRes.status).toBe(200);
      const foundCategory = categoriesRes.body.data.find(
        (c: any) => c.id === workflowCategoryId
      );
      expect(foundCategory._count.post_categories).toBeGreaterThanOrEqual(1);

      // Step 7: Verify tag has the post count updated
      const tagsRes = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(tagsRes.status).toBe(200);
      const foundTag = tagsRes.body.data.find((t: any) => t.id === workflowTagId);
      expect(foundTag._count.post_tags).toBeGreaterThanOrEqual(1);
    });
  });

  describe("API Key Lifecycle Workflow", () => {
    let newKeyId: string;
    let newKeyValue: string;

    afterAll(async () => {
      const prisma = getApiTestPrisma();
      if (newKeyId) {
        await prisma.api_key_usage
          .deleteMany({ where: { api_key_id: newKeyId } })
          .catch(() => {});
        await prisma.api_key_site_access
          .deleteMany({ where: { api_key_id: newKeyId } })
          .catch(() => {});
        await prisma.api_keys.delete({ where: { id: newKeyId } }).catch(() => {});
      }
    });

    it("should complete API key lifecycle: create, use, revoke", async () => {
      // Step 1: Create a new API key
      const createRes = await request(app)
        .post("/api/api-keys")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: `${API_TEST_PREFIX}_lifecycle_key`,
          description: "Key for lifecycle test",
          scopes: ["read"],
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data).toHaveProperty("key");
      newKeyId = createRes.body.data.id;
      newKeyValue = createRes.body.data.key;

      // Step 2: Use the new key to make a request
      const useRes = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${newKeyValue}`);

      expect(useRes.status).toBe(200);

      // Step 3: Check usage was recorded
      await new Promise((resolve) => setTimeout(resolve, 100));

      const usageRes = await request(app)
        .get(`/api/api-keys/${newKeyId}/usage`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(usageRes.status).toBe(200);

      // Step 4: Revoke the key
      const revokeRes = await request(app)
        .post(`/api/api-keys/${newKeyId}/revoke`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ reason: "Lifecycle test complete" });

      expect(revokeRes.status).toBe(200);

      // Step 5: Verify revoked key cannot be used
      const failedUseRes = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${newKeyValue}`);

      expect(failedUseRes.status).toBe(401);
    });
  });

  describe("Site Management Workflow", () => {
    let newSiteId: string;

    afterAll(async () => {
      const prisma = getApiTestPrisma();
      if (newSiteId) {
        await prisma.posts
          .deleteMany({ where: { site_id: newSiteId } })
          .catch(() => {});
        await prisma.categories
          .deleteMany({ where: { site_id: newSiteId } })
          .catch(() => {});
        await prisma.tags
          .deleteMany({ where: { site_id: newSiteId } })
          .catch(() => {});
        await prisma.sites.delete({ where: { id: newSiteId } }).catch(() => {});
      }
    });

    it("should complete site setup workflow", async () => {
      // Step 1: Create a new site (admin key requires owner_id)
      const createRes = await request(app)
        .post("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({
          name: "Workflow Test Site",
          slug: `${API_TEST_SLUG_PREFIX}workflow-site`,
          tagline: "A site for integration testing",
          owner_id: apiTestData.userId,
        });

      expect(createRes.status).toBe(201);
      newSiteId = createRes.body.data.id;

      // Step 2: Update site settings
      const updateRes = await request(app)
        .patch(`/api/sites/${newSiteId}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({
          tagline: "Updated tagline for testing",
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.tagline).toBe("Updated tagline for testing");

      // Step 3: Add categories to the site
      const cat1Res = await request(app)
        .post(`/api/sites/${newSiteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({
          name: "News",
          slug: "news",
        });

      expect(cat1Res.status).toBe(201);

      const cat2Res = await request(app)
        .post(`/api/sites/${newSiteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({
          name: "Tech",
          slug: "tech",
          parent_id: cat1Res.body.data.id,
        });

      expect(cat2Res.status).toBe(201);

      // Step 4: Add tags to the site
      const tagRes = await request(app)
        .post(`/api/sites/${newSiteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`)
        .send({
          name: "Featured",
          slug: "featured",
        });

      expect(tagRes.status).toBe(201);

      // Step 5: Check site statistics
      const statsRes = await request(app)
        .get(`/api/sites/${newSiteId}/stats`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(statsRes.status).toBe(200);
      expect(statsRes.body.data.categories).toBe(2);
      expect(statsRes.body.data.tags).toBe(1);
      expect(statsRes.body.data.posts.total).toBe(0);

      // Step 6: Verify categories list shows hierarchy
      const catsRes = await request(app)
        .get(`/api/sites/${newSiteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(catsRes.status).toBe(200);
      expect(catsRes.body.count).toBe(2);

      const techCategory = catsRes.body.data.find(
        (c: any) => c.slug === "tech"
      );
      expect(techCategory.parent).not.toBeNull();
      expect(techCategory.parent.slug).toBe("news");
    });
  });

  describe("Content Organization Workflow", () => {
    let categoryId: string;
    let subCategoryId: string;
    let tag1Id: string;
    let tag2Id: string;
    let post1Id: string;
    let post2Id: string;

    afterAll(async () => {
      const prisma = getApiTestPrisma();
      // Cleanup
      for (const postId of [post1Id, post2Id]) {
        if (postId) {
          await prisma.post_categories
            .deleteMany({ where: { post_id: postId } })
            .catch(() => {});
          await prisma.post_tags
            .deleteMany({ where: { post_id: postId } })
            .catch(() => {});
          await prisma.posts.delete({ where: { id: postId } }).catch(() => {});
        }
      }
      if (subCategoryId) {
        await prisma.categories
          .delete({ where: { id: subCategoryId } })
          .catch(() => {});
      }
      if (categoryId) {
        await prisma.categories
          .delete({ where: { id: categoryId } })
          .catch(() => {});
      }
      for (const tagId of [tag1Id, tag2Id]) {
        if (tagId) {
          await prisma.tags.delete({ where: { id: tagId } }).catch(() => {});
        }
      }
    });

    it("should organize content with categories and tags", async () => {
      // Setup categories
      const catRes = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Programming",
          slug: `${API_TEST_SLUG_PREFIX}programming`,
        });
      categoryId = catRes.body.data.id;

      const subCatRes = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "JavaScript",
          slug: `${API_TEST_SLUG_PREFIX}javascript`,
          parent_id: categoryId,
        });
      subCategoryId = subCatRes.body.data.id;

      // Setup tags
      const tag1Res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Tutorial",
          slug: `${API_TEST_SLUG_PREFIX}tutorial`,
        });
      tag1Id = tag1Res.body.data.id;

      const tag2Res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Beginner",
          slug: `${API_TEST_SLUG_PREFIX}beginner`,
        });
      tag2Id = tag2Res.body.data.id;

      // Create posts with categories and tags
      const post1Res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          title: "JavaScript Basics",
          slug: `${API_TEST_SLUG_PREFIX}js-basics`,
          content: "Learn JavaScript fundamentals",
          status: "published",
          category_ids: [subCategoryId],
          tag_ids: [tag1Id, tag2Id],
        });
      post1Id = post1Res.body.data.id;

      const post2Res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          title: "Advanced JavaScript",
          slug: `${API_TEST_SLUG_PREFIX}js-advanced`,
          content: "Advanced JavaScript techniques",
          status: "published",
          category_ids: [subCategoryId],
          tag_ids: [tag1Id],
        });
      post2Id = post2Res.body.data.id;

      // Verify tag counts
      const tagsRes = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      const tutorialTag = tagsRes.body.data.find((t: any) => t.id === tag1Id);
      const beginnerTag = tagsRes.body.data.find((t: any) => t.id === tag2Id);

      expect(tutorialTag._count.post_tags).toBe(2);
      expect(beginnerTag._count.post_tags).toBe(1);

      // Verify category counts
      const catsRes = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      const jsCategory = catsRes.body.data.find(
        (c: any) => c.id === subCategoryId
      );
      expect(jsCategory._count.post_categories).toBe(2);
    });
  });

  describe("User Content Access Workflow", () => {
    it("should enforce proper access control across resources", async () => {
      // User key can read their own sites
      const userSitesRes = await request(app)
        .get("/api/sites")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(userSitesRes.status).toBe(200);

      // User key can read posts on their sites
      const postsRes = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(postsRes.status).toBe(200);

      // Read-only key cannot create content
      const createRes = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`)
        .send({
          name: "Should Fail",
          slug: "should-fail",
        });

      expect(createRes.status).toBe(403);

      // Site key can only access its own site
      const siteKeyRes = await request(app)
        .get(`/api/sites/${apiTestData.siteId}`)
        .set("Authorization", `Bearer ${apiTestData.siteApiKey!.key}`);

      expect(siteKeyRes.status).toBe(200);

      // Admin key can access everything
      const adminUsersRes = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(adminUsersRes.status).toBe(200);
    });
  });

  describe("Error Recovery Workflow", () => {
    it("should handle validation errors gracefully", async () => {
      // Try to create post without required fields
      const res1 = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          // Missing title and slug
          content: "Some content",
        });

      expect(res1.status).toBe(400);
      expect(res1.body).toHaveProperty("error");

      // Retry with correct data should succeed
      const res2 = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/posts`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          title: "Recovery Test Post",
          slug: `${API_TEST_SLUG_PREFIX}recovery-post`,
          content: "Some content",
        });

      expect(res2.status).toBe(201);

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.posts.delete({ where: { id: res2.body.data.id } });
    });

    it("should handle duplicate key errors gracefully", async () => {
      const slug = `${API_TEST_SLUG_PREFIX}dup-test-${Date.now()}`;

      // Create first tag
      const res1 = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Duplicate Test",
          slug,
        });

      expect(res1.status).toBe(201);

      // Try to create duplicate
      const res2 = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Duplicate Test 2",
          slug, // Same slug
        });

      expect(res2.status).toBe(409);
      expect(res2.body).toHaveProperty("error", "Conflict");

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.tags.delete({ where: { id: res1.body.data.id } });
    });

    it("should handle not found errors gracefully", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // Try to get non-existent site
      const siteRes = await request(app)
        .get(`/api/sites/${nonExistentId}`)
        .set("Authorization", `Bearer ${apiTestData.adminApiKey!.key}`);

      expect(siteRes.status).toBe(404);

      // Try to update non-existent post
      const postRes = await request(app)
        .patch(`/api/posts/${nonExistentId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ title: "Updated" });

      expect(postRes.status).toBe(404);

      // Try to delete non-existent tag
      const tagRes = await request(app)
        .delete(`/api/tags/${nonExistentId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(tagRes.status).toBe(404);
    });
  });
});
