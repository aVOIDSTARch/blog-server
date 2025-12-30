-- ============================================================================
-- 001_users.sql
-- User management tables for blog system
-- Compatible with Supabase Auth
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- Links to Supabase Auth (auth.users) and stores public profile data
-- ============================================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    bio TEXT,
    website TEXT,

    -- Role flags
    is_verified BOOLEAN DEFAULT FALSE,
    is_moderator BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,

    -- Engagement metrics
    reputation INTEGER DEFAULT 0 CHECK (reputation >= 0),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT username_format CHECK (username ~ '^[a-z0-9_]{3,30}$'),
    CONSTRAINT display_name_length CHECK (char_length(display_name) BETWEEN 1 AND 100)
);

-- Index for common lookups
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_created_at ON public.users(created_at);

-- ============================================================================
-- USER SOCIAL LINKS
-- Normalized social media profiles
-- ============================================================================
CREATE TABLE public.user_social_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- One link per platform per user
    UNIQUE(user_id, platform),

    CONSTRAINT valid_platform CHECK (platform IN (
        'twitter', 'github', 'linkedin', 'mastodon', 'instagram',
        'youtube', 'tiktok', 'facebook', 'bluesky', 'threads', 'other'
    ))
);

CREATE INDEX idx_user_social_links_user_id ON public.user_social_links(user_id);

-- ============================================================================
-- USER BADGES
-- Achievement/role badges for users
-- ============================================================================
CREATE TABLE public.badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Junction table for user badges
CREATE TABLE public.user_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    awarded_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    awarded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

    UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user_id ON public.user_badges(user_id);

-- ============================================================================
-- SEED DEFAULT BADGES
-- ============================================================================
INSERT INTO public.badges (type, label, description, icon) VALUES
    ('author', 'Author', 'Post author', 'pen'),
    ('verified', 'Verified', 'Verified account', 'check'),
    ('moderator', 'Moderator', 'Community moderator', 'shield'),
    ('admin', 'Admin', 'Site administrator', 'crown'),
    ('early_adopter', 'Early Adopter', 'Joined during beta', 'rocket'),
    ('top_contributor', 'Top Contributor', 'Highly active community member', 'star'),
    ('helpful', 'Helpful', 'Provides helpful answers', 'heart'),
    ('first_post', 'First Post', 'Published first blog post', 'flag'),
    ('prolific', 'Prolific Writer', 'Published 10+ posts', 'book')
ON CONFLICT (type) DO NOTHING;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- Triggered when a new user signs up via Supabase Auth
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, display_name, username)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        LOWER(REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-z0-9_]', '_', 'g'))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Users: Anyone can view, only owner can update
CREATE POLICY "Users are viewable by everyone"
    ON public.users FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- Social links: Anyone can view, only owner can manage
CREATE POLICY "Social links are viewable by everyone"
    ON public.user_social_links FOR SELECT
    USING (true);

CREATE POLICY "Users can manage own social links"
    ON public.user_social_links FOR ALL
    USING (auth.uid() = user_id);

-- Badges: Anyone can view
CREATE POLICY "Badges are viewable by everyone"
    ON public.badges FOR SELECT
    USING (true);

-- Only admins can manage badges
CREATE POLICY "Admins can manage badges"
    ON public.badges FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- User badges: Anyone can view, only admins can manage
CREATE POLICY "User badges are viewable by everyone"
    ON public.user_badges FOR SELECT
    USING (true);

CREATE POLICY "Admins can manage user badges"
    ON public.user_badges FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND (is_admin = true OR is_moderator = true)
        )
    );
