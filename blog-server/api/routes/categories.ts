import { Router, type Request, type Response } from "express";
import { requireScope, requireSiteAccess } from "../middleware/auth";

const router = Router();

/**
 * GET /api/sites/:siteId/categories
 * List all categories for a site
 */
router.get(
  "/sites/:siteId/categories",
  requireScope("read"),
  requireSiteAccess("read"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;

      const categories = await prisma.categories.findMany({
        where: { site_id: siteId },
        include: {
          categories: true, // parent category (self-relation)
          _count: {
            select: { post_categories: true },
          },
        },
        orderBy: { name: "asc" },
      });

      // Transform to include parent field
      const transformedCategories = categories.map((cat) => ({
        ...cat,
        parent: cat.categories ? {
          id: cat.categories.id,
          name: cat.categories.name,
          slug: cat.categories.slug,
        } : null,
        categories: undefined,
      }));

      res.json({ data: transformedCategories, count: categories.length });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * POST /api/sites/:siteId/categories
 * Create a new category
 */
router.post(
  "/sites/:siteId/categories",
  requireScope("write"),
  requireSiteAccess("write"),
  async (req: Request, res: Response) => {
    try {
      const { siteId } = req.params;
      const { prisma } = req;
      const { name, slug, description, parent_id } = req.body;

      if (!name || !slug) {
        res.status(400).json({
          error: "Bad Request",
          message: "Name and slug are required",
        });
        return;
      }

      const category = await prisma.categories.create({
        data: {
          name,
          slug,
          description,
          parent_id,
          site_id: siteId,
        },
      });

      res.status(201).json({ data: category });
    } catch (error: any) {
      console.error("Error creating category:", error);
      if (error.code === "P2002") {
        res.status(409).json({
          error: "Conflict",
          message: "A category with this slug already exists in this site",
        });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * PATCH /api/categories/:categoryId
 * Update a category
 */
router.patch(
  "/categories/:categoryId",
  requireScope("write"),
  async (req: Request, res: Response) => {
    try {
      const { categoryId } = req.params;
      const { prisma, apiKey } = req;
      const { name, slug, description, parent_id } = req.body;

      const existingCategory = await prisma.categories.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        res.status(404).json({ error: "Category not found" });
        return;
      }

      // Verify site access
      if (apiKey!.keyType === "site" && existingCategory.site_id !== apiKey!.siteId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const category = await prisma.categories.update({
        where: { id: categoryId },
        data: {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(description !== undefined && { description }),
          ...(parent_id !== undefined && { parent_id }),
        },
      });

      res.json({ data: category });
    } catch (error: any) {
      console.error("Error updating category:", error);
      if (error.code === "P2002") {
        res.status(409).json({
          error: "Conflict",
          message: "A category with this slug already exists",
        });
        return;
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * DELETE /api/categories/:categoryId
 * Delete a category
 */
router.delete(
  "/categories/:categoryId",
  requireScope("delete"),
  async (req: Request, res: Response) => {
    try {
      const { categoryId } = req.params;
      const { prisma, apiKey } = req;

      const existingCategory = await prisma.categories.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        res.status(404).json({ error: "Category not found" });
        return;
      }

      if (apiKey!.keyType === "site" && existingCategory.site_id !== apiKey!.siteId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await prisma.categories.delete({ where: { id: categoryId } });

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
