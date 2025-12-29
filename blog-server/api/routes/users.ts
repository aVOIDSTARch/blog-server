/**
 * @module users
 * @description User management routes for the Blog Server API.
 *
 * This module provides RESTful endpoints for managing users:
 * - List all users (admin only)
 * - Get current authenticated user
 * - Get user profile details
 * - Update user profiles
 * - Get user's accessible sites
 * - Delete users (admin only)
 *
 * ## Authentication
 *
 * Access is determined by API key type:
 * - **Admin keys**: Full access to all user operations
 * - **User keys**: Can view/update own profile only
 * - **Site keys**: Limited access (no user management)
 *
 * ## Endpoints
 *
 * | Method | Path | Description |
 * |--------|------|-------------|
 * | GET | /api/users | List all users (admin) |
 * | GET | /api/users/me | Get current user |
 * | GET | /api/users/:userId | Get user profile |
 * | PATCH | /api/users/:userId | Update user profile |
 * | GET | /api/users/:userId/sites | Get user's sites |
 * | DELETE | /api/users/:userId | Delete user (admin) |
 */

import { Router, type Request, type Response } from "express";
import { requireScope, requireAdmin } from "../middleware/auth";

const router = Router();

/**
 * GET /api/users
 * List all users (admin only)
 */
router.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { prisma } = req;
    const {
      search,
      is_admin,
      is_verified,
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { display_name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (is_admin !== undefined) {
      where.is_admin = is_admin === "true";
    }
    if (is_verified !== undefined) {
      where.is_verified = is_verified === "true";
    }

    const [users, total] = await Promise.all([
      prisma.public_users.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          username: true,
          display_name: true,
          email: true,
          avatar_url: true,
          bio: true,
          website: true,
          is_verified: true,
          is_moderator: true,
          is_admin: true,
          reputation: true,
          created_at: true,
        },
      }),
      prisma.public_users.count({ where }),
    ]);

    res.json({
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/users/me
 * Get current user based on API key
 */
router.get("/me", requireScope("read"), async (req: Request, res: Response) => {
  try {
    const { prisma, apiKey } = req;

    if (!apiKey!.userId) {
      res.status(400).json({
        error: "Bad Request",
        message: "Admin keys do not have an associated user",
      });
      return;
    }

    const user = await prisma.public_users.findUnique({
      where: { id: apiKey!.userId },
      select: {
        id: true,
        username: true,
        display_name: true,
        email: true,
        avatar_url: true,
        bio: true,
        website: true,
        is_verified: true,
        is_moderator: true,
        is_admin: true,
        reputation: true,
        created_at: true,
        updated_at: true,
        user_social_links: true,
        user_badges_user_badges_user_idTousers: {
          include: {
            badges: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ data: user });
  } catch (error) {
    console.error("Error fetching current user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/users/:userId
 * Get a specific user
 */
router.get("/:userId", requireScope("read"), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { prisma, apiKey } = req;

    // Non-admin keys can only view their own profile
    if (apiKey!.keyType !== "admin" && apiKey!.userId !== userId) {
      res.status(403).json({
        error: "Forbidden",
        message: "You can only view your own profile",
      });
      return;
    }

    const user = await prisma.public_users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        display_name: true,
        email: true,
        avatar_url: true,
        bio: true,
        website: true,
        is_verified: true,
        is_moderator: true,
        is_admin: true,
        reputation: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * PATCH /api/users/:userId
 * Update a user
 */
router.patch("/:userId", requireScope("write"), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { prisma, apiKey } = req;

    // Non-admin keys can only update their own profile
    if (apiKey!.keyType !== "admin" && apiKey!.userId !== userId) {
      res.status(403).json({
        error: "Forbidden",
        message: "You can only update your own profile",
      });
      return;
    }

    const {
      username,
      display_name,
      avatar_url,
      bio,
      website,
      // Admin-only fields
      is_verified,
      is_moderator,
      is_admin,
    } = req.body;

    const updateData: any = {
      ...(username !== undefined && { username }),
      ...(display_name !== undefined && { display_name }),
      ...(avatar_url !== undefined && { avatar_url }),
      ...(bio !== undefined && { bio }),
      ...(website !== undefined && { website }),
    };

    // Only admins can update these fields
    if (apiKey!.keyType === "admin") {
      if (is_verified !== undefined) updateData.is_verified = is_verified;
      if (is_moderator !== undefined) updateData.is_moderator = is_moderator;
      if (is_admin !== undefined) updateData.is_admin = is_admin;
    }

    const user = await prisma.public_users.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        display_name: true,
        email: true,
        avatar_url: true,
        bio: true,
        website: true,
        is_verified: true,
        is_moderator: true,
        is_admin: true,
        reputation: true,
        created_at: true,
        updated_at: true,
      },
    });

    res.json({ data: user });
  } catch (error: any) {
    console.error("Error updating user:", error);
    if (error.code === "P2025") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (error.code === "P2002") {
      res.status(409).json({
        error: "Conflict",
        message: "Username already taken",
      });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/users/:userId/sites
 * Get sites owned or accessible by user
 */
router.get("/:userId/sites", requireScope("read"), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { prisma, apiKey } = req;

    // Non-admin keys can only view their own sites
    if (apiKey!.keyType !== "admin" && apiKey!.userId !== userId) {
      res.status(403).json({
        error: "Forbidden",
        message: "You can only view your own sites",
      });
      return;
    }

    const sites = await prisma.sites.findMany({
      where: {
        OR: [
          { owner_id: userId },
          { site_members: { some: { user_id: userId } } },
        ],
      },
      include: {
        _count: {
          select: { posts: true },
        },
        site_members: {
          where: { user_id: userId },
          select: { role: true },
        },
      },
    });

    // Add role to each site
    const sitesWithRole = sites.map((site) => ({
      ...site,
      role: site.owner_id === userId ? "owner" : site.site_members[0]?.role,
      site_members: undefined,
    }));

    res.json({ data: sitesWithRole });
  } catch (error) {
    console.error("Error fetching user sites:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * DELETE /api/users/:userId
 * Delete a user (admin only)
 */
router.delete("/:userId", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { prisma } = req;

    // Delete from public.users (will cascade to related tables)
    await prisma.public_users.delete({
      where: { id: userId },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting user:", error);
    if (error.code === "P2025") {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
