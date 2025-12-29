-- ============================================================================
-- 002_blog_posts.sql
-- Blog posts core tables
-- ============================================================================

-- ============================================================================
-- CATEGORIES TABLE
-- Normalized categories for posts
-- ============================================================================
CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX idx_categories_slug ON public.categories(slug);
CREATE INDEX idx_categories_parent_id ON public.categories(parent_id);

-- ============================================================================
-- TAGS TABLE
-- Normalized tags for posts
-- ============================================================================
CREATE TABLE public.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    post_count INTEGER DEFAULT 0 CHECK (post_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT tag_name_length CHECK (char_length(name) <= 50),
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX idx_tags_slug ON public.tags(slug);
CREATE INDEX idx_tags_post_count ON public.tags(post_count DESC);

-- ============================================================================
-- SERIES TABLE
-- Multi-part post series
-- ============================================================================
CREATE TABLE public.series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    total_parts INTEGER DEFAULT 1 CHECK (total_parts >= 1),
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX idx_series_author_id ON public.series(author_id);
CREATE INDEX idx_series_slug ON public.series(slug);

-- ============================================================================
-- IMAGES TABLE
-- Reusable image storage with metadata
-- ============================================================================
CREATE TABLE public.images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    alt TEXT,
    caption TEXT,
    credit TEXT,
    width INTEGER CHECK (width > 0),
    height INTEGER CHECK (height > 0),
    blurhash TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_images_uploaded_by ON public.images(uploaded_by);

-- ============================================================================
-- IMAGE THUMBNAILS
-- Multiple thumbnail sizes per image
-- ============================================================================
CREATE TABLE public.image_thumbnails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID NOT NULL REFERENCES public.images(id) ON DELETE CASCADE,
    size_name TEXT NOT NULL, -- e.g., 'small', 'medium', 'large'
    url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,

    UNIQUE(image_id, size_name)
);

CREATE INDEX idx_image_thumbnails_image_id ON public.image_thumbnails(image_id);

-- ============================================================================
-- BLOG POSTS TABLE
-- Main posts table
-- ============================================================================
CREATE TYPE post_status AS ENUM (
    'draft', 'pending_review', 'scheduled', 'published', 'archived', 'deleted'
);

CREATE TYPE post_visibility AS ENUM (
    'public', 'private', 'password_protected', 'members_only', 'paid'
);

CREATE TYPE content_format AS ENUM (
    'html', 'markdown', 'mdx', 'plaintext'
);

CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Core content
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    subtitle TEXT,
    description TEXT,
    excerpt TEXT,
    content TEXT NOT NULL,
    content_format content_format DEFAULT 'markdown',

    -- Author
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

    -- Media
    featured_image_id UUID REFERENCES public.images(id) ON DELETE SET NULL,

    -- Organization
    series_id UUID REFERENCES public.series(id) ON DELETE SET NULL,
    series_part INTEGER CHECK (series_part >= 1),

    -- Status
    status post_status DEFAULT 'draft' NOT NULL,
    visibility post_visibility DEFAULT 'public',
    password TEXT, -- For password_protected visibility

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    published_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ,

    -- Reading time
    reading_time_minutes INTEGER CHECK (reading_time_minutes >= 1),
    word_count INTEGER DEFAULT 0 CHECK (word_count >= 0),

    -- Internationalization
    locale TEXT DEFAULT 'en',

    -- Features
    featured BOOLEAN DEFAULT FALSE,
    featured_order INTEGER,

    -- Versioning
    revision INTEGER DEFAULT 1 CHECK (revision >= 1),

    -- Custom fields (JSONB for flexibility)
    custom_fields JSONB DEFAULT '{}'::jsonb,

    -- Constraints
    CONSTRAINT title_length CHECK (char_length(title) BETWEEN 4 AND 200),
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT subtitle_length CHECK (subtitle IS NULL OR char_length(subtitle) <= 300),
    CONSTRAINT description_length CHECK (description IS NULL OR char_length(description) <= 500),
    CONSTRAINT excerpt_length CHECK (excerpt IS NULL OR char_length(excerpt) <= 1000),
    CONSTRAINT locale_format CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

-- Indexes
CREATE INDEX idx_posts_author_id ON public.posts(author_id);
CREATE INDEX idx_posts_slug ON public.posts(slug);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_visibility ON public.posts(visibility);
CREATE INDEX idx_posts_published_at ON public.posts(published_at DESC);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_featured ON public.posts(featured, featured_order) WHERE featured = TRUE;
CREATE INDEX idx_posts_series_id ON public.posts(series_id, series_part);
CREATE INDEX idx_posts_locale ON public.posts(locale);

-- Full text search index
CREATE INDEX idx_posts_fts ON public.posts
    USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(content, '')));

-- ============================================================================
-- POST CO-AUTHORS
-- Junction table for multiple authors
-- ============================================================================
CREATE TABLE public.post_coauthors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_coauthors_post_id ON public.post_coauthors(post_id);
CREATE INDEX idx_post_coauthors_user_id ON public.post_coauthors(user_id);

-- ============================================================================
-- POST CATEGORIES
-- Junction table for post categories
-- ============================================================================
CREATE TABLE public.post_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,

    UNIQUE(post_id, category_id)
);

CREATE INDEX idx_post_categories_post_id ON public.post_categories(post_id);
CREATE INDEX idx_post_categories_category_id ON public.post_categories(category_id);

-- ============================================================================
-- POST TAGS
-- Junction table for post tags
-- ============================================================================
CREATE TABLE public.post_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,

    UNIQUE(post_id, tag_id)
);

CREATE INDEX idx_post_tags_post_id ON public.post_tags(post_id);
CREATE INDEX idx_post_tags_tag_id ON public.post_tags(tag_id);

-- Trigger to update tag post_count
CREATE OR REPLACE FUNCTION public.update_tag_post_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.tags SET post_count = post_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.tags SET post_count = post_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_tags_count_trigger
    AFTER INSERT OR DELETE ON public.post_tags
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tag_post_count();

-- ============================================================================
-- POST IMAGES (Gallery)
-- Additional images for a post
-- ============================================================================
CREATE TABLE public.post_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    image_id UUID NOT NULL REFERENCES public.images(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,

    UNIQUE(post_id, image_id)
);

CREATE INDEX idx_post_images_post_id ON public.post_images(post_id, sort_order);

-- ============================================================================
-- POST TRANSLATIONS
-- Links posts to their translations
-- ============================================================================
CREATE TABLE public.post_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    translated_post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    locale TEXT NOT NULL,

    UNIQUE(original_post_id, locale),
    UNIQUE(translated_post_id),
    CONSTRAINT different_posts CHECK (original_post_id != translated_post_id)
);

CREATE INDEX idx_post_translations_original ON public.post_translations(original_post_id);

-- ============================================================================
-- RELATED POSTS
-- Manual related post links
-- ============================================================================
CREATE TABLE public.related_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    related_post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,

    UNIQUE(post_id, related_post_id),
    CONSTRAINT different_posts CHECK (post_id != related_post_id)
);

CREATE INDEX idx_related_posts_post_id ON public.related_posts(post_id);

-- ============================================================================
-- POST NAVIGATION
-- Previous/Next post links
-- ============================================================================
CREATE TABLE public.post_navigation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    previous_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
    next_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL
);

-- ============================================================================
-- REVISION HISTORY
-- Track post revisions
-- ============================================================================
CREATE TABLE public.post_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    change_note TEXT,

    -- Snapshot of content at this revision (optional)
    title TEXT,
    content TEXT,

    UNIQUE(post_id, revision)
);

CREATE INDEX idx_post_revisions_post_id ON public.post_revisions(post_id, revision DESC);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================
CREATE TRIGGER posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER series_updated_at
    BEFORE UPDATE ON public.series
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_thumbnails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_coauthors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.related_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_navigation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_revisions ENABLE ROW LEVEL SECURITY;

-- Categories and Tags: Public read
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Tags are viewable by everyone" ON public.tags FOR SELECT USING (true);

-- Admins can manage categories and tags
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can manage tags" ON public.tags FOR ALL
    USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true));

-- Series: Public read, author can manage
CREATE POLICY "Series are viewable by everyone" ON public.series FOR SELECT USING (true);
CREATE POLICY "Authors can manage own series" ON public.series FOR ALL
    USING (auth.uid() = author_id);

-- Images: Public read, uploader can manage
CREATE POLICY "Images are viewable by everyone" ON public.images FOR SELECT USING (true);
CREATE POLICY "Users can upload images" ON public.images FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Users can manage own images" ON public.images FOR UPDATE USING (auth.uid() = uploaded_by);
CREATE POLICY "Image thumbnails are viewable by everyone" ON public.image_thumbnails FOR SELECT USING (true);

-- Posts: Complex visibility rules
CREATE POLICY "Published public posts are viewable by everyone"
    ON public.posts FOR SELECT
    USING (
        status = 'published' AND visibility = 'public'
        OR author_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.post_coauthors WHERE post_id = id AND user_id = auth.uid())
    );

CREATE POLICY "Authors can manage own posts"
    ON public.posts FOR ALL
    USING (
        author_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.post_coauthors WHERE post_id = id AND user_id = auth.uid())
    );

-- Junction tables: Public read for published posts
CREATE POLICY "Post categories viewable" ON public.post_categories FOR SELECT USING (true);
CREATE POLICY "Post tags viewable" ON public.post_tags FOR SELECT USING (true);
CREATE POLICY "Post images viewable" ON public.post_images FOR SELECT USING (true);
CREATE POLICY "Post translations viewable" ON public.post_translations FOR SELECT USING (true);
CREATE POLICY "Related posts viewable" ON public.related_posts FOR SELECT USING (true);
CREATE POLICY "Post navigation viewable" ON public.post_navigation FOR SELECT USING (true);
CREATE POLICY "Post coauthors viewable" ON public.post_coauthors FOR SELECT USING (true);

-- Authors can manage junction tables for their posts
CREATE POLICY "Authors manage post categories" ON public.post_categories FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage post tags" ON public.post_tags FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage post images" ON public.post_images FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage post translations" ON public.post_translations FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = original_post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage related posts" ON public.related_posts FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage post navigation" ON public.post_navigation FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage coauthors" ON public.post_coauthors FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));

-- Revisions: Authors can view and create
CREATE POLICY "Revisions viewable by authors" ON public.post_revisions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors can create revisions" ON public.post_revisions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
