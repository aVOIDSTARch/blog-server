/**
 * @module auth
 * @description Authentication and authorization middleware for the Blog Server API.
 *
 * This module provides Express middleware for:
 * - API key authentication
 * - Scope-based authorization
 * - Site-level access control
 * - Admin-only routes
 * - Usage tracking
 *
 * ## Usage
 *
 * ```typescript
 * import { authenticateApiKey, requireScope, requireSiteAccess, requireAdmin } from './middleware/auth';
 *
 * // Apply authentication to all API routes
 * app.use('/api', authenticateApiKey(prisma));
 *
 * // Require specific scopes
 * router.post('/resource', requireScope('write'), handler);
 *
 * // Require site access
 * router.get('/sites/:siteId/posts', requireSiteAccess('read'), handler);
 *
 * // Admin only
 * router.delete('/users/:id', requireAdmin, handler);
 * ```
 */

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

/**
 * Extends Express Request interface to include API key and Prisma client.
 */
declare global {
  namespace Express {
    interface Request {
      /** The validated API key for the current request */
      apiKey?: ValidatedApiKey;
      /** The Prisma client instance for database operations */
      prisma: PrismaClient;
    }
  }
}

/**
 * Extracts API key from request headers.
 *
 * Supports two formats:
 * - `Authorization: Bearer <key>`
 * - `X-API-Key: <key>`
 *
 * @param req - The Express request object
 * @returns The extracted API key, or null if not found
 * @internal
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
 * Extracts the client IP address from the request.
 *
 * Checks `X-Forwarded-For` header for proxied requests.
 *
 * @param req - The Express request object
 * @returns The client IP address
 * @internal
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

/**
 * Creates middleware to authenticate requests using API keys.
 *
 * This middleware:
 * 1. Extracts the API key from headers
 * 2. Validates the key against the database
 * 3. Checks IP and origin restrictions
 * 4. Attaches the validated key to `req.apiKey`
 * 5. Records usage after the response is sent
 *
 * @param prisma - The Prisma client instance
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * app.use('/api', authenticateApiKey(prisma));
 * ```
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
 * Creates middleware to require specific permission scope(s).
 *
 * The request is rejected with 403 if the API key lacks the required scope.
 *
 * @param requiredScopes - One or more scopes required (any one is sufficient)
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * // Require write scope
 * router.post('/posts', requireScope('write'), createPost);
 *
 * // Require either delete or admin scope
 * router.delete('/posts/:id', requireScope('delete', 'admin'), deletePost);
 * ```
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
 * Creates middleware to require access to a specific site.
 *
 * Extracts site ID from `req.params.siteId` or `req.body.site_id`.
 * Rejects with 403 if the API key lacks access to the site.
 *
 * @param requiredScope - The scope level required for access
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * router.get('/sites/:siteId/posts', requireSiteAccess('read'), listPosts);
 * router.post('/sites/:siteId/posts', requireSiteAccess('write'), createPost);
 * ```
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
 * Middleware to require admin API key type.
 *
 * Rejects with 403 if the API key is not an admin key.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 *
 * @example
 * ```typescript
 * router.delete('/users/:id', requireAdmin, deleteUser);
 * ```
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
