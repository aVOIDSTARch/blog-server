/**
 * @module posts
 * @description Post management routes for the Blog Server API.
 *
 * This module provides RESTful endpoints for managing blog posts:
 * - List posts for a site with filtering and pagination
 * - Get individual post details
 * - Create new posts with categories, tags, and SEO metadata
 * - Update existing posts
 * - Delete posts
 *
 * ## Features
 *
 * - **Pagination**: All list endpoints support page/limit parameters
 * - **Filtering**: Filter by status, author, category, tag, or search text
 * - **Sorting**: Sort by any field in ascending or descending order
 * - **Word Count**: Automatic word count and reading time calculation
 * - **SEO**: Support for custom SEO metadata per post
 *
 * ## Authentication
 *
 * All routes require API key authentication with appropriate scopes:
 * - `read` scope: List and view posts
 * - `write` scope: Create and update posts
 * - `delete` scope: Delete posts
 *
 * ## Endpoints
 *
 * | Method | Path | Description |
 * |--------|------|-------------|
 * | GET | /api/sites/:siteId/posts | List posts for a site |
 * | GET | /api/posts/:postId | Get post details |
 * | POST | /api/sites/:siteId/posts | Create a new post |
 * | PATCH | /api/posts/:postId | Update a post |
 * | DELETE | /api/posts/:postId | Delete a post |
 */

import { Router, type Request, type Response } from "express";
import { requireScope, requireSiteAccess } from "../middleware/auth";

const router = Router();

/**
 * GET /api/sites/:siteId/posts
 * List all posts for a site
 */
router.get(
  "/sites/:siteId/posts",
  requireScope("read"),
  requireSiteAccess("read"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;
      const {
        status,
        author_id,
        category_id,
        tag_id,
        search,
        page = "1",
        limit = "20",
        sort = "created_at",
        order = "desc",
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      const where: any = { site_id: siteId };

      if (status) {
        where.status = status;
      }
      if (author_id) {
        where.author_id = author_id;
      }
      if (category_id) {
        where.post_categories = { some: { category_id: category_id } };
      }
      if (tag_id) {
        where.post_tags = { some: { tag_id: tag_id } };
      }
      if (search) {
        where.OR = [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      const [posts, total] = await Promise.all([
        prisma.posts.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { [sort as string]: order },
          include: {
            users: true,
            post_categories: {
              include: {
                categories: true,
              },
            },
            post_tags: {
              include: {
                tags: true,
              },
            },
            post_stats: true,
          },
        }),
        prisma.posts.count({ where }),
      ]);

      // Transform posts to include author field
      const transformedPosts = posts.map((post) => ({
        ...post,
        author: post.users ? {
          id: post.users.id,
          username: post.users.username,
          display_name: post.users.display_name,
        } : null,
        users: undefined,
      }));

      res.json({
        data: transformedPosts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * GET /api/posts/:postId
 * Get a specific post
 */
router.get(
  "/posts/:postId",
  requireScope("read"),
  async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const { prisma, apiKey } = req;

      const post = await prisma.posts.findUnique({
        where: { id: postId },
        include: {
          users: true,
          sites: true,
          series: true,
          post_categories: {
            include: {
              categories: true,
            },
          },
          post_tags: {
            include: {
              tags: true,
            },
          },
          post_stats: true,
          post_seo: true,
        },
      });

      if (!post) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      // Verify access to the post's site
      if (apiKey!.keyType === "site" && post.site_id !== apiKey!.siteId) {
        res.status(403).json({ error: "Access denied to this post" });
        return;
      }

      if (apiKey!.keyType === "user") {
        const site = await prisma.sites.findFirst({
          where: {
            id: post.site_id!,
            OR: [
              { owner_id: apiKey!.userId! },
              { site_members: { some: { user_id: apiKey!.userId! } } },
            ],
          },
        });
        if (!site) {
          res.status(403).json({ error: "Access denied to this post" });
          return;
        }
      }

      // Transform post to include author field
      const transformedPost = {
        ...post,
        author: post.users ? {
          id: post.users.id,
          username: post.users.username,
          display_name: post.users.display_name,
          avatar_url: post.users.avatar_url,
        } : null,
        users: undefined,
      };

      res.json({ data: transformedPost });
    } catch (error) {
      console.error("Error fetching post:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * POST /api/sites/:siteId/posts
 * Create a new post
 */
router.post(
  "/sites/:siteId/posts",
  requireScope("write"),
  requireSiteAccess("write"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma, apiKey } = req;
      const {
        title,
        slug,
        description,
        excerpt,
        content,
        content_format = "markdown",
        status = "draft",
        featured_image_id,
        series_id,
        series_part,
        category_ids,
        tag_ids,
        seo,
      } = req.body;

      if (!title || !slug) {
        res.status(400).json({
          error: "Bad Request",
          message: "Title and slug are required",
        });
        return;
      }

      // Determine author
      let authorId = req.body.author_id;
      if (apiKey!.keyType !== "admin") {
        authorId = apiKey!.userId;
      }

      // Calculate word count and reading time
      const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
      const readingTime = Math.ceil(wordCount / 200);

      const post = await prisma.posts.create({
        data: {
          title,
          slug,
          description,
          excerpt,
          content,
          content_format,
          status,
          featured_image_id,
          series_id,
          series_part,
          word_count: wordCount,
          reading_time_minutes: readingTime,
          author_id: authorId,
          site_id: siteId,
          published_at: status === "published" ? new Date() : null,
        },
      });

      // Create post stats
      await prisma.post_stats.create({
        data: { post_id: post.id },
      });

      // Add categories
      if (category_ids?.length > 0) {
        await prisma.post_categories.createMany({
          data: category_ids.map((categoryId: string) => ({
            post_id: post.id,
            category_id: categoryId,
          })),
        });
      }

      // Add tags
      if (tag_ids?.length > 0) {
        await prisma.post_tags.createMany({
          data: tag_ids.map((tagId: string) => ({
            post_id: post.id,
            tag_id: tagId,
          })),
        });
      }

      // Add SEO if provided
      if (seo) {
        await prisma.post_seo.create({
          data: {
            post_id: post.id,
            ...seo,
          },
        });
      }

      // Fetch complete post with relations
      const completePost = await prisma.posts.findUnique({
        where: { id: post.id },
        include: {
          post_categories: { include: { categories: true } },
          post_tags: { include: { tags: true } },
          post_seo: true,
        },
      });

      res.status(201).json({ data: completePost });
    } catch (error: any) {
      console.error("Error creating post:", error);
      if (error.code === "P2002") {
        res.status(409).json({
          error: "Conflict",
          message: "A post with this slug already exists in this site",
        });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * PATCH /api/posts/:postId
 * Update a post
 */
router.patch(
  "/posts/:postId",
  requireScope("write"),
  async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const { prisma, apiKey } = req;

      // First get the post to check access
      const existingPost = await prisma.posts.findUnique({
        where: { id: postId },
      });

      if (!existingPost) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      // Verify site access
      if (apiKey!.keyType === "site" && existingPost.site_id !== apiKey!.siteId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      if (apiKey!.keyType === "user") {
        const site = await prisma.sites.findFirst({
          where: {
            id: existingPost.site_id!,
            OR: [
              { owner_id: apiKey!.userId! },
              { site_members: { some: { user_id: apiKey!.userId! } } },
            ],
          },
        });
        if (!site) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      }

      const {
        title,
        slug,
        description,
        excerpt,
        content,
        content_format,
        status,
        featured_image_id,
        series_id,
        series_part,
        category_ids,
        tag_ids,
        seo,
      } = req.body;

      // Calculate word count if content changed
      let wordCount, readingTime;
      if (content !== undefined) {
        wordCount = content.split(/\s+/).filter(Boolean).length;
        readingTime = Math.ceil(wordCount / 200);
      }

      // Handle status change to published
      let publishedAt = existingPost.published_at;
      if (status === "published" && existingPost.status !== "published") {
        publishedAt = new Date();
      }

      await prisma.posts.update({
        where: { id: postId },
        data: {
          ...(title !== undefined && { title }),
          ...(slug !== undefined && { slug }),
          ...(description !== undefined && { description }),
          ...(excerpt !== undefined && { excerpt }),
          ...(content !== undefined && { content }),
          ...(content_format !== undefined && { content_format }),
          ...(status !== undefined && { status, published_at: publishedAt }),
          ...(featured_image_id !== undefined && { featured_image_id }),
          ...(series_id !== undefined && { series_id }),
          ...(series_part !== undefined && { series_part }),
          ...(wordCount !== undefined && { word_count: wordCount }),
          ...(readingTime !== undefined && { reading_time_minutes: readingTime }),
        },
      });

      // Update categories if provided
      if (category_ids !== undefined) {
        await prisma.post_categories.deleteMany({ where: { post_id: postId } });
        if (category_ids.length > 0) {
          await prisma.post_categories.createMany({
            data: category_ids.map((categoryId: string) => ({
              post_id: postId,
              category_id: categoryId,
            })),
          });
        }
      }

      // Update tags if provided
      if (tag_ids !== undefined) {
        await prisma.post_tags.deleteMany({ where: { post_id: postId } });
        if (tag_ids.length > 0) {
          await prisma.post_tags.createMany({
            data: tag_ids.map((tagId: string) => ({
              post_id: postId,
              tag_id: tagId,
            })),
          });
        }
      }

      // Update SEO if provided
      if (seo !== undefined) {
        await prisma.post_seo.upsert({
          where: { post_id: postId },
          create: { post_id: postId, ...seo },
          update: seo,
        });
      }

      // Fetch updated post
      const updatedPost = await prisma.posts.findUnique({
        where: { id: postId },
        include: {
          post_categories: { include: { categories: true } },
          post_tags: { include: { tags: true } },
          post_seo: true,
        },
      });

      res.json({ data: updatedPost });
    } catch (error: any) {
      console.error("Error updating post:", error);
      if (error.code === "P2002") {
        res.status(409).json({
          error: "Conflict",
          message: "A post with this slug already exists",
        });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * DELETE /api/posts/:postId
 * Delete a post
 */
router.delete(
  "/posts/:postId",
  requireScope("delete"),
  async (req: Request, res: Response) => {
    try {
      const { postId } = req.params;
      const { prisma, apiKey } = req;

      const existingPost = await prisma.posts.findUnique({
        where: { id: postId },
      });

      if (!existingPost) {
        res.status(404).json({ error: "Post not found" });
        return;
      }

      // Verify site access for non-admin keys
      if (apiKey!.keyType === "site" && existingPost.site_id !== apiKey!.siteId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      if (apiKey!.keyType === "user") {
        const site = await prisma.sites.findFirst({
          where: {
            id: existingPost.site_id!,
            OR: [
              { owner_id: apiKey!.userId! },
              { site_members: { some: { user_id: apiKey!.userId! } } },
            ],
          },
        });
        if (!site) {
          res.status(403).json({ error: "Access denied" });
          return;
        }
      }

      await prisma.posts.delete({ where: { id: postId } });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
