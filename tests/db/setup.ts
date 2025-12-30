import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { randomUUID } from "crypto";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

// Test data prefix for easy identification
// Slugs allow: lowercase letters, numbers, hyphens
// Usernames allow: lowercase letters, numbers, underscores
export const TEST_PREFIX = "vitest";
export const TEST_SLUG_PREFIX = "vitest-";
export const TEST_USERNAME_PREFIX = "vitest_";

// Test data IDs stored globally for cleanup
export interface TestDataIds {
  userId?: string;
  siteId?: string;
  categoryId?: string;
  tagIds?: string[];
  postId?: string;
  seriesId?: string;
  commentId?: string;
  badgeId?: string;
}

export const testDataIds: TestDataIds = {
  tagIds: [],
};

// Create a test-specific Prisma client
let testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    testPrisma = new PrismaClient({ adapter });
  }
  return testPrisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}

// Create test user directly via Prisma (both auth and public schemas)
// Note: A database trigger auto-creates public.users when auth.users is inserted
export async function createTestUser(): Promise<string> {
  const prisma = getTestPrisma();
  const userId = randomUUID();
  const testEmail = `${TEST_PREFIX}_user@test.local`;

  // Create user in auth.users schema
  // This triggers handle_new_user() which auto-creates the public.users record
  await prisma.auth_users.create({
    data: {
      id: userId,
      instance_id: "00000000-0000-0000-0000-000000000000",
      aud: "authenticated",
      role: "authenticated",
      email: testEmail,
      encrypted_password: "$2a$10$placeholder.hash.for.testing.only",
      email_confirmed_at: new Date(),
      raw_app_meta_data: { provider: "email", providers: ["email"] },
      raw_user_meta_data: {
        display_name: `${TEST_PREFIX}_User`,
        username: `${TEST_USERNAME_PREFIX}user`,
      },
      created_at: new Date(),
      updated_at: new Date(),
      confirmation_token: "",
      recovery_token: "",
      email_change_token_new: "",
      email_change: "",
    },
  });

  // Update the auto-created public user with test-specific data
  await prisma.public_users.update({
    where: { id: userId },
    data: {
      username: `${TEST_USERNAME_PREFIX}user`,
      display_name: `${TEST_PREFIX}_User`,
      bio: `${TEST_PREFIX}_Bio - This is a test user for Vitest`,
      website: "https://test.example.com",
    },
  });

  return userId;
}

// Delete test user directly via Prisma
export async function deleteTestUser(userId: string): Promise<void> {
  const prisma = getTestPrisma();

  try {
    // Delete public user first (foreign key constraint)
    await prisma.public_users.delete({
      where: { id: userId },
    }).catch(() => {});

    // Delete auth user
    await prisma.auth_users.delete({
      where: { id: userId },
    }).catch(() => {});
  } catch (error) {
    console.warn(`Warning: Failed to delete test user: ${error}`);
  }
}

// Setup all test data
export async function setupTestData(): Promise<TestDataIds> {
  const prisma = getTestPrisma();

  // Clean up any existing test data first
  await cleanupOrphanedTestData();

  // 1. Create test user via Prisma
  const userId = await createTestUser();
  testDataIds.userId = userId;

  // 2. Create test site
  const site = await prisma.sites.create({
    data: {
      name: `${TEST_PREFIX}_Site`,
      slug: `${TEST_SLUG_PREFIX}site`,
      domain: `${TEST_SLUG_PREFIX}site.example.com`,
      description: `${TEST_PREFIX}_Test site for multi-blog support`,
      tagline: "A test blog",
      owner_id: userId,
      settings: {
        theme: "default",
        locale: "en",
        timezone: "UTC",
        comments_enabled: true,
      },
    },
  });
  testDataIds.siteId = site.id;

  // 3. Create test category (with site_id)
  const category = await prisma.categories.create({
    data: {
      name: `${TEST_PREFIX}_Category`,
      slug: `${TEST_SLUG_PREFIX}category`,
      description: `${TEST_PREFIX}_Category for testing`,
      site_id: site.id,
    },
  });
  testDataIds.categoryId = category.id;

  // 4. Create test tags (with site_id)
  const tag1 = await prisma.tags.create({
    data: {
      name: `${TEST_PREFIX}_Tag1`,
      slug: `${TEST_SLUG_PREFIX}tag1`,
      description: `${TEST_PREFIX}_First test tag`,
      site_id: site.id,
    },
  });
  const tag2 = await prisma.tags.create({
    data: {
      name: `${TEST_PREFIX}_Tag2`,
      slug: `${TEST_SLUG_PREFIX}tag2`,
      description: `${TEST_PREFIX}_Second test tag`,
      site_id: site.id,
    },
  });
  testDataIds.tagIds = [tag1.id, tag2.id];

  // 5. Create test series (with site_id)
  const series = await prisma.series.create({
    data: {
      name: `${TEST_PREFIX}_Series`,
      slug: `${TEST_SLUG_PREFIX}series`,
      description: `${TEST_PREFIX}_Test series for blog posts`,
      total_parts: 3,
      author_id: userId,
      site_id: site.id,
    },
  });
  testDataIds.seriesId = series.id;

  // 6. Create test post (with site_id)
  const post = await prisma.posts.create({
    data: {
      title: `${TEST_PREFIX}_Post`,
      slug: `${TEST_SLUG_PREFIX}post`,
      description: `${TEST_PREFIX}_Test post description`,
      excerpt: `${TEST_PREFIX}_Test post excerpt for display`,
      content: `# ${TEST_PREFIX}_Post\n\nThis is test content for the Vitest test suite.\n\n## Section 1\n\nSome test content here.\n\n## Section 2\n\nMore test content.`,
      content_format: "markdown",
      author_id: userId,
      site_id: site.id,
      series_id: series.id,
      series_part: 1,
      status: "draft",
      word_count: 25,
      reading_time_minutes: 1,
    },
  });
  testDataIds.postId = post.id;

  // 6. Link post to category
  await prisma.post_categories.create({
    data: {
      post_id: post.id,
      category_id: category.id,
    },
  });

  // 7. Link post to tags
  for (const tagId of testDataIds.tagIds) {
    await prisma.post_tags.create({
      data: {
        post_id: post.id,
        tag_id: tagId,
      },
    });
  }

  // 8. Create post stats
  await prisma.post_stats.create({
    data: {
      post_id: post.id,
      views: 100,
      unique_views: 50,
      likes: 10,
      shares: 5,
      bookmarks: 3,
      comment_count: 0,
    },
  });

  // 9. Create post SEO
  await prisma.post_seo.create({
    data: {
      post_id: post.id,
      meta_title: `${TEST_PREFIX}_Post - SEO Title`,
      meta_description: `${TEST_PREFIX}_Meta description for SEO testing`,
      focus_keyword: "test vitest prisma",
    },
  });

  // 10. Create a test comment
  const comment = await prisma.comments.create({
    data: {
      post_id: post.id,
      author_id: userId,
      content: `${TEST_PREFIX}_This is a test comment`,
      content_format: "plaintext",
      status: "approved",
    },
  });
  testDataIds.commentId = comment.id;

  // 11. Create test badge
  const badge = await prisma.badges.create({
    data: {
      type: `${TEST_SLUG_PREFIX}badge`,
      label: `${TEST_PREFIX}_Badge`,
      description: `${TEST_PREFIX}_A test badge for Vitest`,
      icon: "🧪",
      color: "#9333ea",
    },
  });
  testDataIds.badgeId = badge.id;

  // 12. Award badge to user
  await prisma.user_badges.create({
    data: {
      user_id: userId,
      badge_id: badge.id,
    },
  });

  return testDataIds;
}

// Cleanup all test data
export async function cleanupTestData(): Promise<void> {
  const prisma = getTestPrisma();

  try {
    // Delete in reverse order of dependencies

    // Delete user badges
    if (testDataIds.badgeId) {
      await prisma.user_badges.deleteMany({
        where: { badge_id: testDataIds.badgeId },
      });
    }

    // Delete badge
    if (testDataIds.badgeId) {
      await prisma.badges.delete({
        where: { id: testDataIds.badgeId },
      }).catch(() => {});
    }

    // Delete comments (cascade should handle related tables)
    if (testDataIds.commentId) {
      await prisma.comments.delete({
        where: { id: testDataIds.commentId },
      }).catch(() => {});
    }

    // Delete post related data
    if (testDataIds.postId) {
      await prisma.post_seo.deleteMany({
        where: { post_id: testDataIds.postId },
      });
      await prisma.post_stats.deleteMany({
        where: { post_id: testDataIds.postId },
      });
      await prisma.post_tags.deleteMany({
        where: { post_id: testDataIds.postId },
      });
      await prisma.post_categories.deleteMany({
        where: { post_id: testDataIds.postId },
      });
      await prisma.posts.delete({
        where: { id: testDataIds.postId },
      }).catch(() => {});
    }

    // Delete series
    if (testDataIds.seriesId) {
      await prisma.series.delete({
        where: { id: testDataIds.seriesId },
      }).catch(() => {});
    }

    // Delete tags
    if (testDataIds.tagIds && testDataIds.tagIds.length > 0) {
      await prisma.tags.deleteMany({
        where: { id: { in: testDataIds.tagIds } },
      });
    }

    // Delete category
    if (testDataIds.categoryId) {
      await prisma.categories.delete({
        where: { id: testDataIds.categoryId },
      }).catch(() => {});
    }

    // Delete site (this will cascade to site_members)
    if (testDataIds.siteId) {
      await prisma.site_members.deleteMany({
        where: { site_id: testDataIds.siteId },
      }).catch(() => {});
      await prisma.sites.delete({
        where: { id: testDataIds.siteId },
      }).catch(() => {});
    }

    // Delete user via Prisma
    if (testDataIds.userId) {
      await deleteTestUser(testDataIds.userId);
    }

    // Also cleanup any orphaned test data by prefix
    await cleanupOrphanedTestData();

  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// Cleanup any orphaned test data by prefix pattern
export async function cleanupOrphanedTestData(): Promise<void> {
  const prisma = getTestPrisma();

  try {
    // Delete orphaned user badges first
    await prisma.user_badges.deleteMany({
      where: {
        users_user_badges_user_idTousers: {
          username: { startsWith: TEST_USERNAME_PREFIX },
        },
      },
    }).catch(() => {});

    // Delete orphaned comments
    await prisma.comments.deleteMany({
      where: {
        OR: [
          { content: { startsWith: TEST_PREFIX } },
          { posts: { slug: { startsWith: TEST_SLUG_PREFIX } } },
        ],
      },
    }).catch(() => {});

    // Delete orphaned posts by slug pattern
    const orphanedPosts = await prisma.posts.findMany({
      where: { slug: { startsWith: TEST_SLUG_PREFIX } },
      select: { id: true },
    });
    for (const post of orphanedPosts) {
      await prisma.post_code_blocks.deleteMany({ where: { post_id: post.id } }).catch(() => {});
      await prisma.post_seo.deleteMany({ where: { post_id: post.id } }).catch(() => {});
      await prisma.post_stats.deleteMany({ where: { post_id: post.id } }).catch(() => {});
      await prisma.post_tags.deleteMany({ where: { post_id: post.id } }).catch(() => {});
      await prisma.post_categories.deleteMany({ where: { post_id: post.id } }).catch(() => {});
    }
    await prisma.posts.deleteMany({
      where: { slug: { startsWith: TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete orphaned series
    await prisma.series.deleteMany({
      where: { slug: { startsWith: TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete orphaned tags
    await prisma.tags.deleteMany({
      where: { slug: { startsWith: TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete orphaned categories
    await prisma.categories.deleteMany({
      where: { slug: { startsWith: TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete orphaned badges
    await prisma.badges.deleteMany({
      where: { type: { startsWith: TEST_SLUG_PREFIX } },
    }).catch(() => {});

    // Delete orphaned public users
    await prisma.public_users.deleteMany({
      where: { username: { startsWith: TEST_USERNAME_PREFIX } },
    }).catch(() => {});

    // Delete orphaned auth users
    await prisma.auth_users.deleteMany({
      where: { email: { startsWith: TEST_PREFIX } },
    }).catch(() => {});

  } catch (error) {
    console.warn("Warning during orphan cleanup:", error);
  }
}
