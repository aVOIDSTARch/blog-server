import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getTestPrisma,
  disconnectTestPrisma,
  setupTestData,
  cleanupTestData,
  testDataIds,
  TEST_PREFIX,
  TEST_SLUG_PREFIX,
  TEST_USERNAME_PREFIX,
} from "./setup";
import type { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

describe("Database Connection & Setup", () => {
  beforeAll(async () => {
    prisma = getTestPrisma();
    await setupTestData();
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
    await disconnectTestPrisma();
  }, 60000);

  describe("Connection Tests", () => {
    it("should connect to the database", async () => {
      const result = await prisma.$queryRaw`SELECT 1 as connected`;
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should have the correct database schemas", async () => {
      const schemas = await prisma.$queryRaw<{ schema_name: string }[]>`
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name IN ('public', 'auth')
        ORDER BY schema_name
      `;
      expect(schemas.length).toBe(2);
      expect(schemas.map((s) => s.schema_name)).toContain("public");
      expect(schemas.map((s) => s.schema_name)).toContain("auth");
    });
  });

  describe("User Tests", () => {
    it("should have created the test user", async () => {
      const user = await prisma.public_users.findUnique({
        where: { id: testDataIds.userId },
      });
      expect(user).toBeDefined();
      expect(user?.username).toBe(`${TEST_USERNAME_PREFIX}user`);
      expect(user?.display_name).toBe(`${TEST_PREFIX}_User`);
    });

    it("should link public user to auth user", async () => {
      const user = await prisma.public_users.findUnique({
        where: { id: testDataIds.userId },
        include: { users: true },
      });
      expect(user).toBeDefined();
      expect(user?.users).toBeDefined();
      expect(user?.users.id).toBe(testDataIds.userId);
    });

    it("should update user profile", async () => {
      const updatedUser = await prisma.public_users.update({
        where: { id: testDataIds.userId },
        data: { bio: `${TEST_PREFIX}_Updated bio` },
      });
      expect(updatedUser.bio).toBe(`${TEST_PREFIX}_Updated bio`);
    });

    it("should find user by email", async () => {
      const user = await prisma.public_users.findFirst({
        where: { email: { contains: TEST_PREFIX } },
      });
      expect(user).toBeDefined();
      expect(user?.id).toBe(testDataIds.userId);
    });
  });

  describe("Category Tests", () => {
    it("should have created the test category", async () => {
      const category = await prisma.categories.findUnique({
        where: { id: testDataIds.categoryId },
      });
      expect(category).toBeDefined();
      expect(category?.name).toBe(`${TEST_PREFIX}_Category`);
      expect(category?.slug).toBe(`${TEST_SLUG_PREFIX}category`);
    });

    it("should find category by slug", async () => {
      const category = await prisma.categories.findUnique({
        where: { slug: `${TEST_SLUG_PREFIX}category` },
      });
      expect(category).toBeDefined();
      expect(category?.id).toBe(testDataIds.categoryId);
    });

    it("should support nested categories", async () => {
      const childCategory = await prisma.categories.create({
        data: {
          name: `${TEST_PREFIX}_ChildCategory`,
          slug: `${TEST_SLUG_PREFIX}childcategory`,
          parent_id: testDataIds.categoryId,
        },
      });
      expect(childCategory.parent_id).toBe(testDataIds.categoryId);

      // Fetch with parent relation
      const categoryWithParent = await prisma.categories.findUnique({
        where: { id: childCategory.id },
        include: { categories: true },
      });
      expect(categoryWithParent?.categories?.id).toBe(testDataIds.categoryId);

      // Cleanup child
      await prisma.categories.delete({ where: { id: childCategory.id } });
    });
  });

  describe("Tag Tests", () => {
    it("should have created the test tags", async () => {
      const tags = await prisma.tags.findMany({
        where: { id: { in: testDataIds.tagIds } },
      });
      expect(tags.length).toBe(2);
    });

    it("should find tag by slug", async () => {
      const tag = await prisma.tags.findUnique({
        where: { slug: `${TEST_SLUG_PREFIX}tag1` },
      });
      expect(tag).toBeDefined();
      expect(tag?.name).toBe(`${TEST_PREFIX}_Tag1`);
    });

    it("should update tag post count", async () => {
      const updatedTag = await prisma.tags.update({
        where: { id: testDataIds.tagIds![0] },
        data: { post_count: { increment: 1 } },
      });
      expect(updatedTag.post_count).toBeGreaterThan(0);
    });
  });

  describe("Series Tests", () => {
    it("should have created the test series", async () => {
      const series = await prisma.series.findUnique({
        where: { id: testDataIds.seriesId },
      });
      expect(series).toBeDefined();
      expect(series?.name).toBe(`${TEST_PREFIX}_Series`);
      expect(series?.total_parts).toBe(3);
    });

    it("should link series to author", async () => {
      const series = await prisma.series.findUnique({
        where: { id: testDataIds.seriesId },
        include: { users: true },
      });
      expect(series?.users.id).toBe(testDataIds.userId);
    });

    it("should list series posts", async () => {
      const series = await prisma.series.findUnique({
        where: { id: testDataIds.seriesId },
        include: { posts: true },
      });
      expect(series?.posts.length).toBeGreaterThan(0);
      expect(series?.posts[0].series_part).toBe(1);
    });
  });

  describe("Post Tests", () => {
    it("should have created the test post", async () => {
      const post = await prisma.posts.findUnique({
        where: { id: testDataIds.postId },
      });
      expect(post).toBeDefined();
      expect(post?.title).toBe(`${TEST_PREFIX}_Post`);
      expect(post?.status).toBe("draft");
    });

    it("should find post by slug", async () => {
      const post = await prisma.posts.findUnique({
        where: { slug: `${TEST_SLUG_PREFIX}post` },
      });
      expect(post).toBeDefined();
      expect(post?.id).toBe(testDataIds.postId);
    });

    it("should load post with all relations", async () => {
      const post = await prisma.posts.findUnique({
        where: { id: testDataIds.postId },
        include: {
          users: true,
          series: true,
          post_categories: { include: { categories: true } },
          post_tags: { include: { tags: true } },
          post_stats: true,
          post_seo: true,
          comments: true,
        },
      });
      expect(post).toBeDefined();
      expect(post?.users.id).toBe(testDataIds.userId);
      expect(post?.series?.id).toBe(testDataIds.seriesId);
      expect(post?.post_categories.length).toBe(1);
      expect(post?.post_tags.length).toBe(2);
      expect(post?.post_stats).toBeDefined();
      expect(post?.post_seo).toBeDefined();
      expect(post?.comments.length).toBeGreaterThan(0);
    });

    it("should update post status", async () => {
      const updatedPost = await prisma.posts.update({
        where: { id: testDataIds.postId },
        data: {
          status: "published",
          published_at: new Date(),
        },
      });
      expect(updatedPost.status).toBe("published");
      expect(updatedPost.published_at).toBeDefined();
    });

    it("should filter posts by status", async () => {
      const publishedPosts = await prisma.posts.findMany({
        where: {
          status: "published",
          slug: { startsWith: TEST_SLUG_PREFIX },
        },
      });
      expect(publishedPosts.length).toBeGreaterThan(0);
    });

    it("should search posts by title", async () => {
      const posts = await prisma.posts.findMany({
        where: {
          title: { contains: TEST_PREFIX },
        },
      });
      expect(posts.length).toBeGreaterThan(0);
    });
  });

  describe("Post Stats Tests", () => {
    it("should have created post stats", async () => {
      const stats = await prisma.post_stats.findUnique({
        where: { post_id: testDataIds.postId },
      });
      expect(stats).toBeDefined();
      expect(stats?.views).toBe(100);
      expect(stats?.likes).toBe(10);
    });

    it("should increment view count", async () => {
      const updatedStats = await prisma.post_stats.update({
        where: { post_id: testDataIds.postId },
        data: {
          views: { increment: 1 },
          unique_views: { increment: 1 },
        },
      });
      expect(updatedStats.views).toBe(101);
      expect(updatedStats.unique_views).toBe(51);
    });

    it("should increment likes", async () => {
      const updatedStats = await prisma.post_stats.update({
        where: { post_id: testDataIds.postId },
        data: { likes: { increment: 1 } },
      });
      expect(updatedStats.likes).toBe(11);
    });
  });

  describe("Post SEO Tests", () => {
    it("should have created post SEO", async () => {
      const seo = await prisma.post_seo.findUnique({
        where: { post_id: testDataIds.postId },
      });
      expect(seo).toBeDefined();
      expect(seo?.meta_title).toContain(`${TEST_PREFIX}_`);
      expect(seo?.focus_keyword).toBe("test vitest prisma");
    });

    it("should update SEO settings", async () => {
      const updatedSeo = await prisma.post_seo.update({
        where: { post_id: testDataIds.postId },
        data: {
          no_index: true,
          canonical_url: "https://example.com/test-post",
        },
      });
      expect(updatedSeo.no_index).toBe(true);
      expect(updatedSeo.canonical_url).toBe("https://example.com/test-post");
    });
  });

  describe("Comment Tests", () => {
    it("should have created the test comment", async () => {
      const comment = await prisma.comments.findUnique({
        where: { id: testDataIds.commentId },
      });
      expect(comment).toBeDefined();
      expect(comment?.content).toContain(`${TEST_PREFIX}_`);
      expect(comment?.status).toBe("approved");
    });

    it("should link comment to post and author", async () => {
      const comment = await prisma.comments.findUnique({
        where: { id: testDataIds.commentId },
        include: {
          posts: true,
          users_comments_author_idTousers: true,
        },
      });
      expect(comment?.posts.id).toBe(testDataIds.postId);
      expect(comment?.users_comments_author_idTousers?.id).toBe(testDataIds.userId);
    });

    it("should create nested comments", async () => {
      const reply = await prisma.comments.create({
        data: {
          post_id: testDataIds.postId!,
          parent_id: testDataIds.commentId,
          root_id: testDataIds.commentId,
          depth: 1,
          author_id: testDataIds.userId,
          content: `${TEST_PREFIX}_This is a reply`,
          content_format: "plaintext",
          status: "approved",
        },
      });
      expect(reply.parent_id).toBe(testDataIds.commentId);
      expect(reply.depth).toBe(1);

      // Cleanup reply
      await prisma.comments.delete({ where: { id: reply.id } });
    });

    it("should count comments per post", async () => {
      const count = await prisma.comments.count({
        where: { post_id: testDataIds.postId },
      });
      expect(count).toBeGreaterThan(0);
    });
  });

  describe("Badge Tests", () => {
    it("should have created the test badge", async () => {
      const badge = await prisma.badges.findUnique({
        where: { id: testDataIds.badgeId },
      });
      expect(badge).toBeDefined();
      expect(badge?.label).toBe(`${TEST_PREFIX}_Badge`);
      expect(badge?.icon).toBe("🧪");
    });

    it("should have awarded badge to user", async () => {
      const userBadge = await prisma.user_badges.findFirst({
        where: {
          user_id: testDataIds.userId,
          badge_id: testDataIds.badgeId,
        },
        include: { badges: true },
      });
      expect(userBadge).toBeDefined();
      expect(userBadge?.badges.label).toBe(`${TEST_PREFIX}_Badge`);
    });

    it("should list user badges", async () => {
      const user = await prisma.public_users.findUnique({
        where: { id: testDataIds.userId },
        include: {
          user_badges_user_badges_user_idTousers: {
            include: { badges: true },
          },
        },
      });
      expect(user?.user_badges_user_badges_user_idTousers.length).toBeGreaterThan(0);
    });
  });

  describe("Aggregation Tests", () => {
    it("should count total posts", async () => {
      const count = await prisma.posts.count();
      expect(count).toBeGreaterThan(0);
    });

    it("should aggregate post stats", async () => {
      const aggregate = await prisma.post_stats.aggregate({
        where: { post_id: testDataIds.postId },
        _sum: { views: true, likes: true },
        _avg: { views: true },
      });
      expect(aggregate._sum.views).toBeGreaterThan(0);
      expect(aggregate._sum.likes).toBeGreaterThan(0);
    });

    it("should group posts by status", async () => {
      const grouped = await prisma.posts.groupBy({
        by: ["status"],
        _count: { id: true },
      });
      expect(grouped.length).toBeGreaterThan(0);
    });

    it("should count tags per post", async () => {
      const postWithTagCount = await prisma.posts.findUnique({
        where: { id: testDataIds.postId },
        include: { _count: { select: { post_tags: true } } },
      });
      expect(postWithTagCount?._count.post_tags).toBe(2);
    });
  });

  describe("Transaction Tests", () => {
    it("should execute transactions", async () => {
      const [category, tag] = await prisma.$transaction([
        prisma.categories.findUnique({ where: { id: testDataIds.categoryId } }),
        prisma.tags.findUnique({ where: { id: testDataIds.tagIds![0] } }),
      ]);
      expect(category).toBeDefined();
      expect(tag).toBeDefined();
    });

    it("should rollback failed transactions", async () => {
      let error: Error | null = null;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.tags.create({
            data: {
              name: `${TEST_PREFIX}_TransactionTag`,
              slug: `${TEST_SLUG_PREFIX}transactiontag`,
            },
          });
          // Force an error by creating duplicate slug
          await tx.tags.create({
            data: {
              name: `${TEST_PREFIX}_TransactionTag2`,
              slug: `${TEST_SLUG_PREFIX}transactiontag`,
            },
          });
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();

      // Verify rollback - tag should not exist
      const tag = await prisma.tags.findUnique({
        where: { slug: `${TEST_SLUG_PREFIX}transactiontag` },
      });
      expect(tag).toBeNull();
    });
  });

  describe("Query Performance Tests", () => {
    it("should efficiently query posts with pagination", async () => {
      const posts = await prisma.posts.findMany({
        take: 10,
        skip: 0,
        orderBy: { created_at: "desc" },
        include: {
          users: { select: { username: true, display_name: true } },
          post_categories: { include: { categories: true } },
        },
      });
      expect(Array.isArray(posts)).toBe(true);
    });

    it("should use cursor-based pagination", async () => {
      const firstPage = await prisma.posts.findMany({
        take: 1,
        orderBy: { created_at: "desc" },
      });

      if (firstPage.length > 0) {
        const secondPage = await prisma.posts.findMany({
          take: 1,
          skip: 1,
          cursor: { id: firstPage[0].id },
          orderBy: { created_at: "desc" },
        });
        expect(Array.isArray(secondPage)).toBe(true);
      }
    });
  });

  describe("Multi-Schema Tests", () => {
    it("should query auth schema tables", async () => {
      const authUser = await prisma.auth_users.findUnique({
        where: { id: testDataIds.userId },
      });
      expect(authUser).toBeDefined();
      expect(authUser?.email).toContain(TEST_PREFIX);
    });

    it("should join across schemas", async () => {
      const publicUser = await prisma.public_users.findUnique({
        where: { id: testDataIds.userId },
        include: { users: true },
      });
      expect(publicUser?.users.email).toContain(TEST_PREFIX);
    });
  });

  describe("Edge Case Tests", () => {
    it("should handle null values correctly", async () => {
      const post = await prisma.posts.findUnique({
        where: { id: testDataIds.postId },
      });
      // subtitle can be null
      expect(post?.subtitle === null || typeof post?.subtitle === "string").toBe(true);
    });

    it("should handle JSON fields", async () => {
      const postWithCustomFields = await prisma.posts.update({
        where: { id: testDataIds.postId },
        data: {
          custom_fields: { test_key: "test_value", nested: { a: 1 } },
        },
      });
      expect(postWithCustomFields.custom_fields).toEqual({
        test_key: "test_value",
        nested: { a: 1 },
      });
    });

    it("should handle array fields", async () => {
      // post_code_blocks has highlight_lines as Int[]
      const codeBlock = await prisma.post_code_blocks.create({
        data: {
          post_id: testDataIds.postId!,
          language: "typescript",
          code: "const x = 1;",
          highlight_lines: [1, 3, 5],
        },
      });
      expect(codeBlock.highlight_lines).toEqual([1, 3, 5]);

      // Cleanup
      await prisma.post_code_blocks.delete({ where: { id: codeBlock.id } });
    });

    it("should handle date/time fields", async () => {
      const now = new Date();
      const post = await prisma.posts.update({
        where: { id: testDataIds.postId },
        data: { scheduled_at: now },
      });
      expect(post.scheduled_at).toBeInstanceOf(Date);
    });

    it("should handle enum values", async () => {
      const statuses = ["draft", "pending_review", "scheduled", "published", "archived", "deleted"];
      const post = await prisma.posts.findUnique({
        where: { id: testDataIds.postId },
      });
      expect(statuses).toContain(post?.status);
    });
  });
});
