import { Router, type Request, type Response } from "express";
import { requireScope, requireSiteAccess } from "../middleware/auth";

const router = Router();

/**
 * GET /api/sites/:siteId/tags
 * List all tags for a site
 */
router.get(
  "/sites/:siteId/tags",
  requireScope("read"),
  requireSiteAccess("read"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;

      const tags = await prisma.tags.findMany({
        where: { site_id: siteId },
        include: {
          _count: {
            select: { post_tags: true },
          },
        },
        orderBy: { name: "asc" },
      });

      res.json({ data: tags, count: tags.length });
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * POST /api/sites/:siteId/tags
 * Create a new tag
 */
router.post(
  "/sites/:siteId/tags",
  requireScope("write"),
  requireSiteAccess("write"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;
      const { name, slug, description, color } = req.body;

      if (!name || !slug) {
        res.status(400).json({
          error: "Bad Request",
          message: "Name and slug are required",
        });
        return;
      }

      const tag = await prisma.tags.create({
        data: {
          name,
          slug,
          description,
          color,
          site_id: siteId,
        },
      });

      res.status(201).json({ data: tag });
    } catch (error: any) {
      console.error("Error creating tag:", error);
      if (error.code === "P2002") {
        res.status(409).json({
          error: "Conflict",
          message: "A tag with this slug already exists in this site",
        });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * PATCH /api/tags/:tagId
 * Update a tag
 */
router.patch(
  "/tags/:tagId",
  requireScope("write"),
  async (req: Request, res: Response) => {
    try {
      const { tagId } = req.params;
      const { prisma, apiKey } = req;
      const { name, slug, description, color } = req.body;

      const existingTag = await prisma.tags.findUnique({
        where: { id: tagId },
      });

      if (!existingTag) {
        res.status(404).json({ error: "Tag not found" });
        return;
      }

      if (apiKey!.keyType === "site" && existingTag.site_id !== apiKey!.siteId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const tag = await prisma.tags.update({
        where: { id: tagId },
        data: {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(description !== undefined && { description }),
          ...(color !== undefined && { color }),
        },
      });

      res.json({ data: tag });
    } catch (error: any) {
      console.error("Error updating tag:", error);
      if (error.code === "P2002") {
        res.status(409).json({
          error: "Conflict",
          message: "A tag with this slug already exists",
        });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * DELETE /api/tags/:tagId
 * Delete a tag
 */
router.delete(
  "/tags/:tagId",
  requireScope("delete"),
  async (req: Request, res: Response) => {
    try {
      const { tagId } = req.params;
      const { prisma, apiKey } = req;

      const existingTag = await prisma.tags.findUnique({
        where: { id: tagId },
      });

      if (!existingTag) {
        res.status(404).json({ error: "Tag not found" });
        return;
      }

      if (apiKey!.keyType === "site" && existingTag.site_id !== apiKey!.siteId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await prisma.tags.delete({ where: { id: tagId } });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
