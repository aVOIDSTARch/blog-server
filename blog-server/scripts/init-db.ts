/**
 * Database Initialization Script
 *
 * This script sets up the initial data for your blog:
 * - Creates the main site
 * - Creates an admin user
 * - Creates a test user (optional)
 *
 * Run with: npm run db:init
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "dotenv";
import { randomUUID } from "crypto";
import * as readline from "readline";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function questionWithDefault(prompt: string, defaultValue: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${prompt} [${defaultValue}]: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

function questionYesNo(prompt: string, defaultYes: boolean = true): Promise<boolean> {
  return new Promise((resolve) => {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    rl.question(`${prompt} ${hint}: `, (answer) => {
      const normalized = answer.trim().toLowerCase();
      if (normalized === "") {
        resolve(defaultYes);
      } else {
        resolve(normalized === "y" || normalized === "yes");
      }
    });
  });
}

// Create Prisma client
function getPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// Generate a slug from a string
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

// Generate a username from display name
function usernameify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 30);
}

interface SiteConfig {
  name: string;
  slug: string;
  domain?: string;
  description?: string;
  tagline?: string;
}

interface UserConfig {
  email: string;
  username: string;
  displayName: string;
  bio?: string;
  isAdmin: boolean;
}

async function collectSiteInfo(): Promise<SiteConfig> {
  console.log("\n📝 Site Configuration\n");

  const name = await question("Site name: ");
  if (!name) {
    throw new Error("Site name is required");
  }

  const defaultSlug = slugify(name);
  const slug = await questionWithDefault("Site slug (URL-friendly)", defaultSlug);

  const domain = await question("Custom domain (optional, e.g., myblog.com): ");
  const description = await question("Site description (optional): ");
  const tagline = await question("Site tagline (optional): ");

  return {
    name,
    slug,
    domain: domain || undefined,
    description: description || undefined,
    tagline: tagline || undefined,
  };
}

async function collectUserInfo(userType: "admin" | "test"): Promise<UserConfig> {
  const label = userType === "admin" ? "Admin" : "Test";
  console.log(`\n👤 ${label} User Configuration\n`);

  const email = await question(`${label} email: `);
  if (!email || !email.includes("@")) {
    throw new Error(`Valid ${label.toLowerCase()} email is required`);
  }

  const displayName = await question(`${label} display name: `);
  if (!displayName) {
    throw new Error(`${label} display name is required`);
  }

  const defaultUsername = usernameify(displayName);
  const username = await questionWithDefault(`${label} username`, defaultUsername);

  const bio = await question(`${label} bio (optional): `);

  return {
    email,
    username,
    displayName,
    bio: bio || undefined,
    isAdmin: userType === "admin",
  };
}

async function createAuthUser(prisma: PrismaClient, config: UserConfig): Promise<string> {
  const userId = randomUUID();

  // Check if user already exists
  const existingUser = await prisma.public_users.findFirst({
    where: {
      OR: [
        { email: config.email },
        { username: config.username },
      ],
    },
  });

  if (existingUser) {
    console.log(`  ⚠️  User with email or username already exists, using existing user`);
    return existingUser.id;
  }

  // Create user in auth.users schema
  // This triggers handle_new_user() which auto-creates the public.users record
  await prisma.auth_users.create({
    data: {
      id: userId,
      instance_id: "00000000-0000-0000-0000-000000000000",
      aud: "authenticated",
      role: "authenticated",
      email: config.email,
      encrypted_password: "$2a$10$placeholder.hash.for.supabase.auth",
      email_confirmed_at: new Date(),
      raw_app_meta_data: { provider: "email", providers: ["email"] },
      raw_user_meta_data: {
        display_name: config.displayName,
        username: config.username,
      },
      created_at: new Date(),
      updated_at: new Date(),
      confirmation_token: "",
      recovery_token: "",
      email_change_token_new: "",
      email_change: "",
    },
  });

  // Update the auto-created public user with additional data
  await prisma.public_users.update({
    where: { id: userId },
    data: {
      username: config.username,
      display_name: config.displayName,
      bio: config.bio,
      is_admin: config.isAdmin,
      is_verified: config.isAdmin,
    },
  });

  return userId;
}

async function createSite(prisma: PrismaClient, config: SiteConfig, ownerId: string): Promise<string> {
  // Check if site already exists
  const existingSite = await prisma.sites.findFirst({
    where: {
      OR: [
        { slug: config.slug },
        ...(config.domain ? [{ domain: config.domain }] : []),
      ],
    },
  });

  if (existingSite) {
    console.log(`  ⚠️  Site with slug or domain already exists, using existing site`);
    return existingSite.id;
  }

  const site = await prisma.sites.create({
    data: {
      name: config.name,
      slug: config.slug,
      domain: config.domain,
      description: config.description,
      tagline: config.tagline,
      owner_id: ownerId,
      settings: {
        theme: "default",
        locale: "en",
        timezone: "UTC",
        comments_enabled: true,
        require_comment_approval: false,
        allow_anonymous_comments: false,
      },
      is_active: true,
      is_public: true,
    },
  });

  return site.id;
}

async function createDefaultCategories(prisma: PrismaClient, siteId: string): Promise<void> {
  const defaultCategories = [
    { name: "General", slug: "general", description: "General posts" },
    { name: "Technology", slug: "technology", description: "Tech-related posts" },
    { name: "Tutorial", slug: "tutorial", description: "How-to guides and tutorials" },
  ];

  for (const cat of defaultCategories) {
    const existing = await prisma.categories.findFirst({
      where: { slug: cat.slug, site_id: siteId },
    });

    if (!existing) {
      await prisma.categories.create({
        data: { ...cat, site_id: siteId },
      });
    }
  }
}

async function createDefaultTags(prisma: PrismaClient, siteId: string): Promise<void> {
  const defaultTags = [
    { name: "Getting Started", slug: "getting-started", description: "Introductory content" },
    { name: "Tips", slug: "tips", description: "Tips and tricks" },
    { name: "News", slug: "news", description: "News and updates" },
  ];

  for (const tag of defaultTags) {
    const existing = await prisma.tags.findFirst({
      where: { slug: tag.slug, site_id: siteId },
    });

    if (!existing) {
      await prisma.tags.create({
        data: { ...tag, site_id: siteId },
      });
    }
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           Blog Database Initialization Script              ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const prisma = getPrisma();

  try {
    // Test database connection
    console.log("\n🔌 Testing database connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("  ✅ Database connected successfully\n");

    // Collect site information
    const siteConfig = await collectSiteInfo();

    // Collect admin user information
    const adminConfig = await collectUserInfo("admin");

    // Ask about test user
    const createTestUser = await questionYesNo("\nCreate a test user?", true);
    let testConfig: UserConfig | null = null;
    if (createTestUser) {
      testConfig = await collectUserInfo("test");
    }

    // Confirm before proceeding
    console.log("\n" + "─".repeat(60));
    console.log("Summary:");
    console.log("─".repeat(60));
    console.log(`Site: ${siteConfig.name} (${siteConfig.slug})`);
    if (siteConfig.domain) console.log(`  Domain: ${siteConfig.domain}`);
    console.log(`Admin: ${adminConfig.displayName} <${adminConfig.email}>`);
    if (testConfig) {
      console.log(`Test User: ${testConfig.displayName} <${testConfig.email}>`);
    }
    console.log("─".repeat(60));

    const confirmed = await questionYesNo("\nProceed with initialization?", true);
    if (!confirmed) {
      console.log("\n❌ Initialization cancelled");
      return;
    }

    // Create admin user
    console.log("\n🔨 Creating admin user...");
    const adminId = await createAuthUser(prisma, adminConfig);
    console.log(`  ✅ Admin user created (ID: ${adminId})`);

    // Create site with admin as owner
    console.log("\n🏠 Creating site...");
    const siteId = await createSite(prisma, siteConfig, adminId);
    console.log(`  ✅ Site created (ID: ${siteId})`);

    // Create default categories and tags
    console.log("\n📁 Creating default categories...");
    await createDefaultCategories(prisma, siteId);
    console.log("  ✅ Default categories created");

    console.log("\n🏷️  Creating default tags...");
    await createDefaultTags(prisma, siteId);
    console.log("  ✅ Default tags created");

    // Add admin as site member with owner role
    const existingMembership = await prisma.site_members.findFirst({
      where: { site_id: siteId, user_id: adminId },
    });
    if (!existingMembership) {
      await prisma.site_members.create({
        data: {
          site_id: siteId,
          user_id: adminId,
          role: "owner",
        },
      });
    }

    // Create test user if requested
    if (testConfig) {
      console.log("\n👤 Creating test user...");
      const testId = await createAuthUser(prisma, testConfig);
      console.log(`  ✅ Test user created (ID: ${testId})`);

      // Add test user as site member with author role
      const existingTestMembership = await prisma.site_members.findFirst({
        where: { site_id: siteId, user_id: testId },
      });
      if (!existingTestMembership) {
        await prisma.site_members.create({
          data: {
            site_id: siteId,
            user_id: testId,
            role: "author",
          },
        });
      }
      console.log("  ✅ Test user added to site as author");
    }

    console.log("\n" + "═".repeat(60));
    console.log("✅ Database initialization complete!");
    console.log("═".repeat(60));
    console.log("\nNext steps:");
    console.log("  1. Users can sign in via Supabase Auth");
    console.log("  2. Admin can manage the site at your admin dashboard");
    console.log("  3. Start creating posts!\n");

  } catch (error) {
    console.error("\n❌ Error during initialization:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main();
