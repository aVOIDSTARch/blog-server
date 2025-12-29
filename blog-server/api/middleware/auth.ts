import type { Request, Response, NextFunction } from "express";
import type { PrismaClient } from "@prisma/client";
import {
  validateApiKey,
  hasScope,
  hasAccessToSite,
  recordUsage,
  isIpAllowed,
  isOriginAllowed,
  type ValidatedApiKey,
} from "../../src/lib/api-keys";
import type { api_key_scope } from "@prisma/client";

// Extend Express Request to include API key info
declare global {
  namespace Express {
    interface Request {
      apiKey?: ValidatedApiKey;
      prisma: PrismaClient;
    }
  }
}

/**
 * Extract API key from request headers
 * Supports: Authorization: Bearer <key> or X-API-Key: <key>
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string") {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Get client IP address
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

/**
 * Middleware to authenticate API key
 */
export function authenticateApiKey(
  prisma: PrismaClient
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    req.prisma = prisma;

    const key = extractApiKey(req);
    if (!key) {
      res.status(401).json({
        error: "Unauthorized",
        message: "API key is required",
      });
      return;
    }

    const validatedKey = await validateApiKey(prisma, key);
    if (!validatedKey) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired API key",
      });
      return;
    }

    // Check IP restrictions
    const clientIp = getClientIp(req);
    if (!isIpAllowed(validatedKey, clientIp)) {
      res.status(403).json({
        error: "Forbidden",
        message: "IP address not allowed",
      });
      return;
    }

    // Check origin restrictions
    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(validatedKey, origin)) {
      res.status(403).json({
        error: "Forbidden",
        message: "Origin not allowed",
      });
      return;
    }

    req.apiKey = validatedKey;

    // Record usage after response is sent
    res.on("finish", () => {
      const responseTime = Date.now() - startTime;
      recordUsage(prisma, validatedKey.id, {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTimeMs: responseTime,
        ipAddress: clientIp,
        userAgent: req.headers["user-agent"],
        origin: origin,
      }).catch(console.error);
    });

    next();
  };
}

/**
 * Middleware to require specific scope(s)
 */
export function requireScope(
  ...requiredScopes: api_key_scope[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
      return;
    }

    const hasRequiredScope = requiredScopes.some((scope) =>
      hasScope(req.apiKey!, scope)
    );

    if (!hasRequiredScope) {
      res.status(403).json({
        error: "Forbidden",
        message: `Required scope: ${requiredScopes.join(" or ")}`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require site access
 * Extracts site_id from params or body
 */
export function requireSiteAccess(
  requiredScope: api_key_scope
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      });
      return;
    }

    const siteId = req.params.siteId || req.body?.site_id;
    if (!siteId) {
      res.status(400).json({
        error: "Bad Request",
        message: "Site ID is required",
      });
      return;
    }

    const hasAccess = await hasAccessToSite(
      req.prisma,
      req.apiKey,
      siteId,
      requiredScope
    );

    if (!hasAccess) {
      res.status(403).json({
        error: "Forbidden",
        message: "Access to this site is not allowed",
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin key type
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.apiKey) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required",
    });
    return;
  }

  if (req.apiKey.keyType !== "admin") {
    res.status(403).json({
      error: "Forbidden",
      message: "Admin access required",
    });
    return;
  }

  next();
}
