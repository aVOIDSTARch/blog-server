/**
 * @module sites
 * @description Site management routes for the Blog Server API.
 *
 * This module provides RESTful endpoints for managing blog sites:
 * - List accessible sites
 * - Get site details with owner/member information
 * - Create new sites
 * - Update site settings
 * - Delete sites (admin only)
 * - Get site statistics
 *
 * ## Authentication
 *
 * All routes require API key authentication. Access is determined by key type:
 * - **Admin keys**: Full access to all sites
 * - **User keys**: Access to owned sites and sites with membership
 * - **Site keys**: Access to the specific site only
 *
 * ## Endpoints
 *
 * | Method | Path | Description |
 * |--------|------|-------------|
 * | GET | /api/sites | List accessible sites |
 * | GET | /api/sites/:siteId | Get site details |
 * | POST | /api/sites | Create a new site |
 * | PATCH | /api/sites/:siteId | Update site settings |
 * | DELETE | /api/sites/:siteId | Delete a site (admin) |
 * | GET | /api/sites/:siteId/stats | Get site statistics |
 */

import { Router, type Request, type Response } from "express";
import { requireScope, requireSiteAccess, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * GET /api/sites
 * List all sites accessible to the current API key
 */
router.get("/", requireScope("read"), async (req: Request, res: Response) => {
  try {
    const { apiKey, prisma } = req;

    let sites;

    if (apiKey!.keyType === "admin") {
      // Admin keys can see all sites
      sites = await prisma.sites.findMany({
        orderBy: { created_at: "desc" },
      });
    } else if (apiKey!.keyType === "site") {
      // Site keys can only see their specific site
      sites = await prisma.sites.findMany({
        where: { id: apiKey!.siteId! },
      });
    } else {
      // User keys can see owned sites and sites with membership
      sites = await prisma.sites.findMany({
        where: {
          OR: [
            { owner_id: apiKey!.userId! },
            { site_members: { some: { user_id: apiKey!.userId! } } },
          ],
        },
        orderBy: { created_at: "desc" },
      });
    }

    res.json({ data: sites, count: sites.length });
  } catch (error) {
    console.error("Error fetching sites:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/sites/:siteId
 * Get a specific site by ID
 */
router.get(
  "/:siteId",
  requireScope("read"),
  requireSiteAccess("read"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;

      const site = await prisma.sites.findUnique({
        where: { id: siteId },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              display_name: true,
            },
          },
          site_members: {
            include: {
              users: {
                select: {
                  id: true,
                  username: true,
                  display_name: true,
                },
              },
            },
          },
          _count: {
            select: {
              posts: true,
              categories: true,
              tags: true,
            },
          },
        },
      });

      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      res.json({ data: site });
    } catch (error) {
      console.error("Error fetching site:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * POST /api/sites
 * Create a new site (admin or user key with write scope)
 */
router.post("/", requireScope("write"), async (req: Request, res: Response) => {
  try {
    const { apiKey, prisma } = req;
    const { name, slug, domain, subdomain, description, tagline, settings } =
      req.body;

    if (!name || !slug) {
      res.status(400).json({
        error: "Bad Request",
        message: "Name and slug are required",
      });
      return;
    }

    // Determine owner: admin keys can specify, user keys use their own user
    let ownerId = req.body.owner_id;
    if (apiKey!.keyType !== "admin") {
      ownerId = apiKey!.userId;
    }

    if (!ownerId) {
      res.status(400).json({
        error: "Bad Request",
        message: "Owner ID is required for admin keys",
      });
      return;
    }

    const site = await prisma.sites.create({
      data: {
        name,
        slug,
        domain,
        subdomain,
        description,
        tagline,
        settings,
        owner_id: ownerId,
      },
    });

    res.status(201).json({ data: site });
  } catch (error: any) {
    console.error("Error creating site:", error);
    if (error.code === "P2002") {
      res.status(409).json({
        error: "Conflict",
        message: "A site with this slug or domain already exists",
      });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * PATCH /api/sites/:siteId
 * Update a site
 */
router.patch(
  "/:siteId",
  requireScope("write"),
  requireSiteAccess("write"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;
      const { name, slug, domain, subdomain, description, tagline, settings, is_active, is_public } =
        req.body;

      const site = await prisma.sites.update({
        where: { id: siteId },
        data: {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(domain !== undefined && { domain }),
          ...(subdomain !== undefined && { subdomain }),
          ...(description !== undefined && { description }),
          ...(tagline !== undefined && { tagline }),
          ...(settings !== undefined && { settings }),
          ...(is_active !== undefined && { is_active }),
          ...(is_public !== undefined && { is_public }),
        },
      });

      res.json({ data: site });
    } catch (error: any) {
      console.error("Error updating site:", error);
      if (error.code === "P2025") {
        res.status(404).json({ error: "Site not found" });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * DELETE /api/sites/:siteId
 * Delete a site (admin only)
 */
router.delete(
  "/:siteId",
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;

      await prisma.sites.delete({
        where: { id: siteId },
      });

      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting site:", error);
      if (error.code === "P2025") {
        res.status(404).json({ error: "Site not found" });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * GET /api/sites/:siteId/stats
 * Get site statistics
 */
router.get(
  "/:siteId/stats",
  requireScope("read"),
  requireSiteAccess("read"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;

      const [postsCount, publishedCount, categoriesCount, tagsCount, membersCount] =
        await Promise.all([
          prisma.posts.count({ where: { site_id: siteId } }),
          prisma.posts.count({ where: { site_id: siteId, status: "published" } }),
          prisma.categories.count({ where: { site_id: siteId } }),
          prisma.tags.count({ where: { site_id: siteId } }),
          prisma.site_members.count({ where: { site_id: siteId } }),
        ]);

      res.json({
        data: {
          posts: {
            total: postsCount,
            published: publishedCount,
            draft: postsCount - publishedCount,
          },
          categories: categoriesCount,
          tags: tagsCount,
          members: membersCount,
        },
      });
    } catch (error) {
      console.error("Error fetching site stats:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
