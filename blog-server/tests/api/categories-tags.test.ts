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

describe("Categories API", () => {
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

  describe("GET /api/sites/:siteId/categories", () => {
    it("should list all categories for a site", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("count");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should include post count in categories", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      // Categories should have _count for post associations
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty("_count");
      }
    });

    it("should deny access for site key of different site", async () => {
      const prisma = getApiTestPrisma();
      const otherSite = await prisma.sites.create({
        data: {
          name: "Other Site Categories",
          slug: `${API_TEST_SLUG_PREFIX}other-cat`,
          owner_id: apiTestData.userId!,
        },
      });

      const res = await request(app)
        .get(`/api/sites/${otherSite.id}/categories`)
        .set("Authorization", `Bearer ${apiTestData.siteApiKey!.key}`);

      expect(res.status).toBe(403);

      await prisma.sites.delete({ where: { id: otherSite.id } });
    });
  });

  describe("POST /api/sites/:siteId/categories", () => {
    it("should create a new category", async () => {
      const newCategory = {
        name: "New Test Category",
        slug: `${API_TEST_SLUG_PREFIX}new-category`,
        description: "A new category for testing",
      };

      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send(newCategory);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("name", newCategory.name);
      expect(res.body.data).toHaveProperty("slug", newCategory.slug);

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.categories.delete({ where: { id: res.body.data.id } });
    });

    it("should reject category creation without required fields", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ description: "Missing name and slug" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Bad Request");
    });

    it("should reject duplicate category slugs", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Duplicate Category",
          slug: `${API_TEST_SLUG_PREFIX}category`, // Already exists
        });

      expect(res.status).toBe(409);
    });

    it("should create category with parent", async () => {
      const childCategory = {
        name: "Child Category",
        slug: `${API_TEST_SLUG_PREFIX}child-category`,
        parent_id: apiTestData.categoryId,
      };

      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/categories`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send(childCategory);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty("parent_id", apiTestData.categoryId);

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.categories.delete({ where: { id: res.body.data.id } });
    });
  });

  describe("PATCH /api/categories/:categoryId", () => {
    it("should update a category", async () => {
      const res = await request(app)
        .patch(`/api/categories/${apiTestData.categoryId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ description: "Updated category description" });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("description", "Updated category description");
    });

    it("should deny update for site key of different site", async () => {
      const prisma = getApiTestPrisma();
      const otherSite = await prisma.sites.create({
        data: {
          name: "Other Site",
          slug: `${API_TEST_SLUG_PREFIX}other-site-cat`,
          owner_id: apiTestData.userId!,
        },
      });
      const otherCategory = await prisma.categories.create({
        data: {
          name: "Other Category",
          slug: `${API_TEST_SLUG_PREFIX}other-site-category`,
          site_id: otherSite.id,
        },
      });

      const res = await request(app)
        .patch(`/api/categories/${otherCategory.id}`)
        .set("Authorization", `Bearer ${apiTestData.siteApiKey!.key}`)
        .send({ description: "Should not update" });

      expect(res.status).toBe(403);

      await prisma.categories.delete({ where: { id: otherCategory.id } });
      await prisma.sites.delete({ where: { id: otherSite.id } });
    });
  });

  describe("DELETE /api/categories/:categoryId", () => {
    it("should delete a category", async () => {
      const prisma = getApiTestPrisma();
      const categoryToDelete = await prisma.categories.create({
        data: {
          name: "Category To Delete",
          slug: `${API_TEST_SLUG_PREFIX}cat-to-delete`,
          site_id: apiTestData.siteId!,
        },
      });

      const res = await request(app)
        .delete(`/api/categories/${categoryToDelete.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(204);

      const deleted = await prisma.categories.findUnique({
        where: { id: categoryToDelete.id },
      });
      expect(deleted).toBeNull();
    });

    it("should deny deletion with read-only key", async () => {
      const res = await request(app)
        .delete(`/api/categories/${apiTestData.categoryId}`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`);

      expect(res.status).toBe(403);
    });
  });
});

describe("Tags API", () => {
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

  describe("GET /api/sites/:siteId/tags", () => {
    it("should list all tags for a site", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("count");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should include post count in tags", async () => {
      const res = await request(app)
        .get(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty("_count");
      }
    });
  });

  describe("POST /api/sites/:siteId/tags", () => {
    it("should create a new tag", async () => {
      const newTag = {
        name: "New Test Tag",
        slug: `${API_TEST_SLUG_PREFIX}new-tag`,
        description: "A new tag for testing",
      };

      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send(newTag);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("name", newTag.name);
      expect(res.body.data).toHaveProperty("slug", newTag.slug);

      // Cleanup
      const prisma = getApiTestPrisma();
      await prisma.tags.delete({ where: { id: res.body.data.id } });
    });

    it("should reject tag creation without required fields", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ description: "Missing name and slug" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Bad Request");
    });

    it("should reject duplicate tag slugs", async () => {
      const res = await request(app)
        .post(`/api/sites/${apiTestData.siteId}/tags`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          name: "Duplicate Tag",
          slug: `${API_TEST_SLUG_PREFIX}tag`, // Already exists
        });

      expect(res.status).toBe(409);
    });
  });

  describe("PATCH /api/tags/:tagId", () => {
    it("should update a tag", async () => {
      const res = await request(app)
        .patch(`/api/tags/${apiTestData.tagId}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({
          description: "Updated tag description",
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("description", "Updated tag description");
    });

    it("should return 404 for non-existent tag", async () => {
      const res = await request(app)
        .patch("/api/tags/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`)
        .send({ description: "Should not work" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/tags/:tagId", () => {
    it("should delete a tag", async () => {
      const prisma = getApiTestPrisma();
      const tagToDelete = await prisma.tags.create({
        data: {
          name: "Tag To Delete",
          slug: `${API_TEST_SLUG_PREFIX}tag-to-delete`,
          site_id: apiTestData.siteId!,
        },
      });

      const res = await request(app)
        .delete(`/api/tags/${tagToDelete.id}`)
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(204);

      const deleted = await prisma.tags.findUnique({
        where: { id: tagToDelete.id },
      });
      expect(deleted).toBeNull();
    });

    it("should deny deletion with read-only key", async () => {
      const res = await request(app)
        .delete(`/api/tags/${apiTestData.tagId}`)
        .set("Authorization", `Bearer ${apiTestData.readOnlyApiKey!.key}`);

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent tag", async () => {
      const res = await request(app)
        .delete("/api/tags/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${apiTestData.userApiKey!.key}`);

      expect(res.status).toBe(404);
    });
  });
});
