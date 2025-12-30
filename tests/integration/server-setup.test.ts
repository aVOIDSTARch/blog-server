import { describe, it, expect } from "vitest";

/**
 * Server startup tests are skipped by default because they spawn real processes.
 * Run with: TEST_SERVER_STARTUP=1 npm test -- tests/integration/server-setup.test.ts
 *
 * These tests verify that:
 * - The API server starts successfully on port 3000
 * - Health check endpoint responds correctly
 * - API info endpoint is accessible
 * - OpenAPI spec is served
 * - Authentication is required for protected endpoints
 */
describe.skipIf(!process.env.TEST_SERVER_STARTUP)("Server Startup (requires real server)", () => {
  it("should start the API server on port 3000", async () => {
    // This test would spawn the server and verify it starts
    // Skipped by default - run with TEST_SERVER_STARTUP=1
    const response = await fetch("http://localhost:3000/api/health");
    expect(response.ok).toBe(true);
  });

  it("should respond to health check endpoint", async () => {
    const response = await fetch("http://localhost:3000/api/health");
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("timestamp");
  });

  it("should return API info at root endpoint", async () => {
    const response = await fetch("http://localhost:3000/api");
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty("name", "Blog API");
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("documentation", "/api/docs");
  });

  it("should serve OpenAPI spec", async () => {
    const response = await fetch("http://localhost:3000/api/openapi.json");
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty("openapi");
    expect(data).toHaveProperty("info");
    expect(data).toHaveProperty("paths");
  });

  it("should require authentication for protected endpoints", async () => {
    const response = await fetch("http://localhost:3000/api/sites");
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data).toHaveProperty("error", "Unauthorized");
  });
});

describe("Vite Configuration", () => {
  it("should have proxy configuration for /api routes", async () => {
    const { default: viteConfig } = await import("../../vite.config");
    const config =
      typeof viteConfig === "function" ? viteConfig({} as any) : viteConfig;

    expect(config).toHaveProperty("server");
    expect(config.server).toHaveProperty("proxy");
    expect(config.server?.proxy).toHaveProperty("/api");

    const apiProxy = config.server?.proxy?.["/api"] as any;
    expect(apiProxy).toHaveProperty("target", "http://localhost:3000");
    expect(apiProxy).toHaveProperty("changeOrigin", true);
  });

  it("should use SolidJS plugin", async () => {
    const { default: viteConfig } = await import("../../vite.config");
    const config =
      typeof viteConfig === "function" ? viteConfig({} as any) : viteConfig;

    expect(config).toHaveProperty("plugins");
    expect(Array.isArray(config.plugins)).toBe(true);
    expect(config.plugins?.length).toBeGreaterThan(0);
  });

  it("should target esnext for build", async () => {
    const { default: viteConfig } = await import("../../vite.config");
    const config =
      typeof viteConfig === "function" ? viteConfig({} as any) : viteConfig;

    expect(config).toHaveProperty("build");
    expect(config.build).toHaveProperty("target", "esnext");
  });
});

describe("Package Scripts", () => {
  it("should have concurrent dev script", async () => {
    const pkg = await import("../../package.json");

    expect(pkg.scripts).toHaveProperty("dev");
    expect(pkg.scripts.dev).toContain("concurrently");
    expect(pkg.scripts.dev).toContain("dev:api");
    expect(pkg.scripts.dev).toContain("dev:web");
  });

  it("should have separate dev:web script for frontend only", async () => {
    const pkg = await import("../../package.json");

    expect(pkg.scripts).toHaveProperty("dev:web");
    expect(pkg.scripts["dev:web"]).toBe("vite");
  });

  it("should have dev:api script for backend only", async () => {
    const pkg = await import("../../package.json");

    expect(pkg.scripts).toHaveProperty("dev:api");
    expect(pkg.scripts["dev:api"]).toContain("tsx");
    expect(pkg.scripts["dev:api"]).toContain("watch");
  });

  it("should have concurrent start script for production", async () => {
    const pkg = await import("../../package.json");

    expect(pkg.scripts).toHaveProperty("start");
    expect(pkg.scripts.start).toContain("concurrently");
    expect(pkg.scripts.start).toContain("start:api");
    expect(pkg.scripts.start).toContain("preview");
  });

  it("should have concurrently as a dev dependency", async () => {
    const pkg = await import("../../package.json");

    expect(pkg.devDependencies).toHaveProperty("concurrently");
  });
});
