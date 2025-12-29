import { Router, type Request, type Response } from "express";
import { requireScope, requireAdmin } from "../middleware/auth";
import {
  createApiKey,
  revokeApiKey,
  listUserApiKeys,
  getKeyUsageStats,
  grantSiteAccess,
  revokeSiteAccess,
} from "../../src/lib/api-keys";
import type { api_key_scope, api_key_type } from "@prisma/client";

const router = Router();

/**
 * GET /api/api-keys
 * List API keys for current user or all (admin)
 */
router.get("/", requireScope("read"), async (req: Request, res: Response) => {
  try {
    const { prisma, apiKey } = req;

    if (apiKey!.keyType === "admin") {
      // Admin can list all keys or filter by user
      const { user_id, key_type, is_active } = req.query;

      const where: any = {};
      if (user_id) where.user_id = user_id;
      if (key_type) where.key_type = key_type;
      if (is_active !== undefined) where.is_active = is_active === "true";

      const keys = await prisma.api_keys.findMany({
        where,
        orderBy: { created_at: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          key_prefix: true,
          key_type: true,
          user_id: true,
          site_id: true,
          scopes: true,
          rate_limit_per_minute: true,
          rate_limit_per_day: true,
          is_active: true,
          last_used_at: true,
          usage_count: true,
          expires_at: true,
          created_at: true,
          user: {
            select: { id: true, username: true, display_name: true },
          },
          site: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      // Convert BigInt to Number for JSON serialization
      const serializedKeys = keys.map((key) => ({
        ...key,
        usage_count: Number(key.usage_count ?? 0),
      }));

      res.json({ data: serializedKeys, count: keys.length });
    } else if (apiKey!.userId) {
      // User can only list their own keys
      const keys = await listUserApiKeys(prisma, apiKey!.userId);
      res.json({ data: keys, count: keys.length });
    } else {
      res.status(400).json({
        error: "Bad Request",
        message: "Cannot list API keys for this key type",
      });
    }
  } catch (error) {
    console.error("Error listing API keys:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/api-keys/:keyId
 * Get a specific API key details
 */
router.get("/:keyId", requireScope("read"), async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const { prisma, apiKey } = req;

    const key = await prisma.api_keys.findUnique({
      where: { id: keyId },
      select: {
        id: true,
        name: true,
        description: true,
        key_prefix: true,
        key_type: true,
        user_id: true,
        site_id: true,
        scopes: true,
        rate_limit_per_minute: true,
        rate_limit_per_day: true,
        is_active: true,
        last_used_at: true,
        usage_count: true,
        expires_at: true,
        revoked_at: true,
        revoke_reason: true,
        allowed_ips: true,
        allowed_origins: true,
        created_at: true,
        updated_at: true,
        user: {
          select: { id: true, username: true, display_name: true },
        },
        site: {
          select: { id: true, name: true, slug: true },
        },
        site_access: {
          include: {
            site: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!key) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    // Non-admin keys can only view their own keys
    if (apiKey!.keyType !== "admin" && key.user_id !== apiKey!.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Convert BigInt to Number for JSON serialization
    res.json({
      data: {
        ...key,
        usage_count: Number(key.usage_count ?? 0),
      },
    });
  } catch (error) {
    console.error("Error fetching API key:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/api-keys
 * Create a new API key
 */
router.post("/", requireScope("write"), async (req: Request, res: Response) => {
  try {
    const { prisma, apiKey } = req;
    const {
      name,
      description,
      key_type,
      user_id,
      site_id,
      scopes,
      rate_limit_per_minute,
      rate_limit_per_day,
      expires_at,
      allowed_ips,
      allowed_origins,
      metadata,
    } = req.body;

    if (!name) {
      res.status(400).json({
        error: "Bad Request",
        message: "Name is required",
      });
      return;
    }

    // Validate key type permissions
    const keyType: api_key_type = key_type || "user";

    // Only admin keys can create admin keys
    if (keyType === "admin" && apiKey!.keyType !== "admin") {
      res.status(403).json({
        error: "Forbidden",
        message: "Only admin keys can create admin keys",
      });
      return;
    }

    // Determine user_id for non-admin keys
    let targetUserId = user_id;
    if (keyType !== "admin" && apiKey!.keyType !== "admin") {
      targetUserId = apiKey!.userId;
    }

    // Validate site ownership for site keys
    if (keyType === "site" && site_id && apiKey!.keyType !== "admin") {
      const site = await prisma.sites.findFirst({
        where: {
          id: site_id,
          owner_id: apiKey!.userId!,
        },
      });
      if (!site) {
        res.status(403).json({
          error: "Forbidden",
          message: "You can only create site keys for sites you own",
        });
        return;
      }
    }

    const { apiKey: newKey, id } = await createApiKey(prisma, {
      name,
      description,
      keyType,
      userId: targetUserId,
      siteId: site_id,
      scopes: scopes as api_key_scope[],
      rateLimitPerMinute: rate_limit_per_minute,
      rateLimitPerDay: rate_limit_per_day,
      expiresAt: expires_at ? new Date(expires_at) : undefined,
      allowedIps: allowed_ips,
      allowedOrigins: allowed_origins,
      metadata,
    });

    // Return the key details - the actual key is only shown once!
    res.status(201).json({
      data: {
        id,
        key: newKey.key, // Only time the full key is shown
        key_prefix: newKey.prefix,
        name,
        key_type: keyType,
      },
      message: "Save this API key securely - it will not be shown again",
    });
  } catch (error: any) {
    console.error("Error creating API key:", error);
    if (error.message) {
      res.status(400).json({
        error: "Bad Request",
        message: error.message,
      });
      return;
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * PATCH /api/api-keys/:keyId
 * Update an API key (name, description, rate limits, restrictions)
 */
router.patch("/:keyId", requireScope("write"), async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const { prisma, apiKey } = req;

    const existingKey = await prisma.api_keys.findUnique({
      where: { id: keyId },
    });

    if (!existingKey) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    // Non-admin keys can only update their own keys
    if (apiKey!.keyType !== "admin" && existingKey.user_id !== apiKey!.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const {
      name,
      description,
      rate_limit_per_minute,
      rate_limit_per_day,
      allowed_ips,
      allowed_origins,
      metadata,
    } = req.body;

    // Cannot change key type or scopes after creation for security
    const key = await prisma.api_keys.update({
      where: { id: keyId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(rate_limit_per_minute !== undefined && { rate_limit_per_minute }),
        ...(rate_limit_per_day !== undefined && { rate_limit_per_day }),
        ...(allowed_ips !== undefined && { allowed_ips }),
        ...(allowed_origins !== undefined && { allowed_origins }),
        ...(metadata !== undefined && { metadata }),
      },
    });

    // Convert BigInt to Number for JSON serialization
    res.json({
      data: {
        ...key,
        usage_count: Number(key.usage_count ?? 0),
      },
    });
  } catch (error) {
    console.error("Error updating API key:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/api-keys/:keyId/revoke
 * Revoke an API key
 */
router.post("/:keyId/revoke", requireScope("write"), async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const { prisma, apiKey } = req;
    const { reason } = req.body;

    const existingKey = await prisma.api_keys.findUnique({
      where: { id: keyId },
    });

    if (!existingKey) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    // Non-admin keys can only revoke their own keys
    if (apiKey!.keyType !== "admin" && existingKey.user_id !== apiKey!.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    await revokeApiKey(prisma, keyId, apiKey!.userId || undefined, reason);

    res.json({ message: "API key revoked successfully" });
  } catch (error) {
    console.error("Error revoking API key:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /api/api-keys/:keyId/usage
 * Get usage statistics for an API key
 */
router.get("/:keyId/usage", requireScope("read"), async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const { prisma, apiKey } = req;
    const { start_date, end_date } = req.query;

    const existingKey = await prisma.api_keys.findUnique({
      where: { id: keyId },
    });

    if (!existingKey) {
      res.status(404).json({ error: "API key not found" });
      return;
    }

    // Non-admin keys can only view their own key stats
    if (apiKey!.keyType !== "admin" && existingKey.user_id !== apiKey!.userId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const stats = await getKeyUsageStats(prisma, keyId, {
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
    });

    res.json({ data: stats });
  } catch (error) {
    console.error("Error fetching API key usage:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * POST /api/api-keys/:keyId/site-access
 * Grant site access to an API key
 */
router.post(
  "/:keyId/site-access",
  requireScope("write"),
  async (req: Request, res: Response) => {
    try {
      const { keyId } = req.params;
      const { prisma, apiKey } = req;
      const { site_id, scopes } = req.body;

      if (!site_id || !scopes) {
        res.status(400).json({
          error: "Bad Request",
          message: "site_id and scopes are required",
        });
        return;
      }

      const existingKey = await prisma.api_keys.findUnique({
        where: { id: keyId },
      });

      if (!existingKey) {
        res.status(404).json({ error: "API key not found" });
        return;
      }

      // Non-admin keys can only manage their own key access
      if (apiKey!.keyType !== "admin" && existingKey.user_id !== apiKey!.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      // Verify site ownership for non-admin
      if (apiKey!.keyType !== "admin") {
        const site = await prisma.sites.findFirst({
          where: {
            id: site_id,
            OR: [
              { owner_id: apiKey!.userId! },
              { site_members: { some: { user_id: apiKey!.userId! } } },
            ],
          },
        });
        if (!site) {
          res.status(403).json({
            error: "Forbidden",
            message: "You do not have access to this site",
          });
          return;
        }
      }

      await grantSiteAccess(prisma, keyId, site_id, scopes);

      res.json({ message: "Site access granted successfully" });
    } catch (error) {
      console.error("Error granting site access:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * DELETE /api/api-keys/:keyId/site-access/:siteId
 * Revoke site access from an API key
 */
router.delete(
  "/:keyId/site-access/:siteId",
  requireScope("write"),
  async (req: Request, res: Response) => {
    try {
      const { keyId, siteId } = req.params;
      const { prisma, apiKey } = req;

      const existingKey = await prisma.api_keys.findUnique({
        where: { id: keyId },
      });

      if (!existingKey) {
        res.status(404).json({ error: "API key not found" });
        return;
      }

      // Non-admin keys can only manage their own key access
      if (apiKey!.keyType !== "admin" && existingKey.user_id !== apiKey!.userId) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      await revokeSiteAccess(prisma, keyId, siteId);

      res.json({ message: "Site access revoked successfully" });
    } catch (error) {
      console.error("Error revoking site access:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

export default router;
