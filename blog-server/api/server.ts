import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import swaggerUi from "swagger-ui-express";
import { parse } from "yaml";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Import middleware
import { authenticateApiKey } from "./middleware/auth";

// Load OpenAPI specification
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const openapiSpec = parse(
  readFileSync(join(__dirname, "openapi.yaml"), "utf-8")
);

// Import routes
import sitesRouter from "./routes/sites";
import postsRouter from "./routes/posts";
import usersRouter from "./routes/users";
import apiKeysRouter from "./routes/api-keys";
import categoriesRouter from "./routes/categories";
import tagsRouter from "./routes/tags";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

// Initialize database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(",") || "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
}));
app.use(express.json());

// Health check endpoint (no auth required)
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API version info (no auth required)
app.get("/api", (_req, res) => {
  res.json({
    name: "Blog API",
    version: "1.0.0",
    documentation: "/api/docs",
  });
});

// Swagger UI documentation (no auth required)
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Blog API Documentation",
}));

// Serve OpenAPI spec as JSON (no auth required)
app.get("/api/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});

// Apply API key authentication to all /api routes (except health, info, and docs)
app.use("/api", (req, res, next) => {
  if (req.path === "/health" || req.path === "/" || req.path.startsWith("/docs") || req.path === "/openapi.json") {
    return next();
  }
  return authenticateApiKey(prisma)(req, res, next);
});

// Register routes
app.use("/api/sites", sitesRouter);
app.use("/api", postsRouter); // Has /sites/:siteId/posts and /posts/:postId
app.use("/api/users", usersRouter);
app.use("/api/api-keys", apiKeysRouter);
app.use("/api", categoriesRouter); // Has /sites/:siteId/categories and /categories/:categoryId
app.use("/api", tagsRouter); // Has /sites/:siteId/tags and /tags/:tagId

// 404 handler for API routes
app.use("/api/{*splat}", (_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.API_PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`API Documentation: http://localhost:${PORT}/api/docs`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down...");
  server.close(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down...");
  server.close(async () => {
    await prisma.$disconnect();
    await pool.end();
    process.exit(0);
  });
});

export default app;
