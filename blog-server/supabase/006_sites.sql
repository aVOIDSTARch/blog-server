-- ============================================================================
-- 006_sites.sql
-- Multi-site support - allows multiple blogs to share the same database
-- ============================================================================

-- ============================================================================
-- SITES TABLE
-- Core table for multi-tenancy support
-- ============================================================================
CREATE TABLE public.sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Site identification
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT UNIQUE,  -- Custom domain (e.g., myblog.com)
    subdomain TEXT UNIQUE,  -- Subdomain (e.g., myblog for myblog.platform.com)

    -- Site metadata
    description TEXT,
    tagline TEXT,
    logo_url TEXT,
    favicon_url TEXT,

    -- Owner/Admin
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

    -- Settings (JSONB for flexibility)
    settings JSONB DEFAULT '{
        "theme": "default",
        "locale": "en",
        "timezone": "UTC",
        "comments_enabled": true,
        "require_comment_approval": false,
        "allow_anonymous_comments": false
    }'::jsonb,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT domain_format CHECK (domain IS NULL OR domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
    CONSTRAINT subdomain_format CHECK (subdomain IS NULL OR subdomain ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- Indexes
CREATE INDEX idx_sites_owner_id ON public.sites(owner_id);
CREATE INDEX idx_sites_domain ON public.sites(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_sites_subdomain ON public.sites(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX idx_sites_slug ON public.sites(slug);
CREATE INDEX idx_sites_is_active ON public.sites(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- SITE MEMBERS
-- Users who can contribute to a site (beyond just the owner)
-- ============================================================================
CREATE TYPE site_role AS ENUM ('owner', 'admin', 'editor', 'author', 'contributor');

CREATE TABLE public.site_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role site_role NOT NULL DEFAULT 'contributor',
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(site_id, user_id)
);

CREATE INDEX idx_site_members_site_id ON public.site_members(site_id);
CREATE INDEX idx_site_members_user_id ON public.site_members(user_id);

-- ============================================================================
-- ADD site_id TO EXISTING TABLES
-- ============================================================================

-- Add site_id to categories
ALTER TABLE public.categories ADD COLUMN site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE;

-- Add site_id to tags
ALTER TABLE public.tags ADD COLUMN site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE;

-- Add site_id to series
ALTER TABLE public.series ADD COLUMN site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE;

-- Add site_id to posts
ALTER TABLE public.posts ADD COLUMN site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE;

-- Add site_id to images (optional - images could be shared or per-site)
ALTER TABLE public.images ADD COLUMN site_id UUID REFERENCES public.sites(id) ON DELETE SET NULL;

-- ============================================================================
-- UPDATE UNIQUE CONSTRAINTS TO BE SITE-SCOPED
-- Slugs should be unique per site, not globally
-- ============================================================================

-- Categories: Drop global unique, add site-scoped unique
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_slug_key;
CREATE UNIQUE INDEX idx_categories_site_slug ON public.categories(site_id, slug) WHERE site_id IS NOT NULL;
CREATE UNIQUE INDEX idx_categories_site_name ON public.categories(site_id, name) WHERE site_id IS NOT NULL;

-- Tags: Drop global unique, add site-scoped unique
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_name_key;
ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_slug_key;
CREATE UNIQUE INDEX idx_tags_site_slug ON public.tags(site_id, slug) WHERE site_id IS NOT NULL;
CREATE UNIQUE INDEX idx_tags_site_name ON public.tags(site_id, name) WHERE site_id IS NOT NULL;

-- Series: Drop global unique, add site-scoped unique
ALTER TABLE public.series DROP CONSTRAINT IF EXISTS series_slug_key;
CREATE UNIQUE INDEX idx_series_site_slug ON public.series(site_id, slug) WHERE site_id IS NOT NULL;

-- Posts: Drop global unique, add site-scoped unique
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_slug_key;
CREATE UNIQUE INDEX idx_posts_site_slug ON public.posts(site_id, slug) WHERE site_id IS NOT NULL;

-- ============================================================================
-- ADD NEW INDEXES FOR SITE QUERIES
-- ============================================================================
CREATE INDEX idx_categories_site_id ON public.categories(site_id);
CREATE INDEX idx_tags_site_id ON public.tags(site_id);
CREATE INDEX idx_series_site_id ON public.series(site_id);
CREATE INDEX idx_posts_site_id ON public.posts(site_id);
CREATE INDEX idx_images_site_id ON public.images(site_id) WHERE site_id IS NOT NULL;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER sites_updated_at
    BEFORE UPDATE ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_members ENABLE ROW LEVEL SECURITY;

-- Sites: Public sites are viewable by everyone
CREATE POLICY "Public sites are viewable by everyone"
    ON public.sites FOR SELECT
    USING (is_public = TRUE AND is_active = TRUE);

-- Site owners and members can view their sites
CREATE POLICY "Members can view their sites"
    ON public.sites FOR SELECT
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.site_members
            WHERE site_id = id AND user_id = auth.uid()
        )
    );

-- Only owners can update sites
CREATE POLICY "Owners can update sites"
    ON public.sites FOR UPDATE
    USING (owner_id = auth.uid());

-- Authenticated users can create sites
CREATE POLICY "Authenticated users can create sites"
    ON public.sites FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Only owners can delete sites
CREATE POLICY "Owners can delete sites"
    ON public.sites FOR DELETE
    USING (owner_id = auth.uid());

-- Site members: viewable by site members
CREATE POLICY "Site members viewable by members"
    ON public.site_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sites
            WHERE id = site_id AND (owner_id = auth.uid() OR is_public = TRUE)
        )
        OR user_id = auth.uid()
    );

-- Site owners/admins can manage members
CREATE POLICY "Owners and admins can manage members"
    ON public.site_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.sites WHERE id = site_id AND owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.site_members
            WHERE site_id = site_members.site_id
            AND user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
    );

-- ============================================================================
-- UPDATE EXISTING RLS POLICIES TO INCLUDE SITE CONTEXT
-- These would need to be updated to scope access by site membership
-- ============================================================================

-- Example: Update posts policy to check site membership
-- DROP POLICY IF EXISTS "Authors can manage own posts" ON public.posts;
-- CREATE POLICY "Authors can manage own posts"
--     ON public.posts FOR ALL
--     USING (
--         author_id = auth.uid()
--         OR EXISTS (SELECT 1 FROM public.post_coauthors WHERE post_id = id AND user_id = auth.uid())
--         OR EXISTS (
--             SELECT 1 FROM public.site_members
--             WHERE site_id = posts.site_id
--             AND user_id = auth.uid()
--             AND role IN ('owner', 'admin', 'editor')
--         )
--     );
