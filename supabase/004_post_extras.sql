-- ============================================================================
-- 004_post_extras.sql
-- Additional post features: SEO, embeds, code blocks, stats, sponsorship
-- ============================================================================

-- ============================================================================
-- POST SEO METADATA
-- ============================================================================
CREATE TABLE public.post_seo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    meta_title TEXT,
    meta_description TEXT,
    canonical_url TEXT,
    focus_keyword TEXT,
    no_index BOOLEAN DEFAULT FALSE,
    no_follow BOOLEAN DEFAULT FALSE,
    structured_data JSONB,

    CONSTRAINT meta_title_length CHECK (meta_title IS NULL OR char_length(meta_title) <= 60),
    CONSTRAINT meta_description_length CHECK (meta_description IS NULL OR char_length(meta_description) <= 160)
);

CREATE INDEX idx_post_seo_post_id ON public.post_seo(post_id);

-- ============================================================================
-- POST OPEN GRAPH METADATA
-- ============================================================================
CREATE TABLE public.post_open_graph (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    image_url TEXT,
    type TEXT DEFAULT 'article' CHECK (type IN ('article', 'website', 'blog'))
);

CREATE INDEX idx_post_open_graph_post_id ON public.post_open_graph(post_id);

-- ============================================================================
-- POST TWITTER CARD METADATA
-- ============================================================================
CREATE TABLE public.post_twitter_card (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    card TEXT DEFAULT 'summary_large_image' CHECK (card IN ('summary', 'summary_large_image', 'player')),
    title TEXT,
    description TEXT,
    image_url TEXT
);

CREATE INDEX idx_post_twitter_card_post_id ON public.post_twitter_card(post_id);

-- ============================================================================
-- POST EMBEDS
-- External media embeds (YouTube, Vimeo, etc.)
-- ============================================================================
CREATE TYPE embed_type AS ENUM (
    'youtube', 'vimeo', 'twitter', 'codepen', 'codesandbox',
    'gist', 'spotify', 'soundcloud', 'custom'
);

CREATE TABLE public.post_embeds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    type embed_type NOT NULL,
    url TEXT NOT NULL,
    embed_code TEXT,
    caption TEXT,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_post_embeds_post_id ON public.post_embeds(post_id, sort_order);

-- ============================================================================
-- POST CODE BLOCKS
-- Syntax-highlighted code snippets
-- ============================================================================
CREATE TABLE public.post_code_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    language TEXT,
    code TEXT NOT NULL,
    filename TEXT,
    highlight_lines INTEGER[],
    show_line_numbers BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_post_code_blocks_post_id ON public.post_code_blocks(post_id, sort_order);

-- ============================================================================
-- POST TABLE OF CONTENTS
-- Auto-generated or manual TOC
-- ============================================================================
CREATE TABLE public.post_toc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    heading_id TEXT NOT NULL,
    text TEXT NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 6),
    parent_id UUID REFERENCES public.post_toc(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_post_toc_post_id ON public.post_toc(post_id, sort_order);

-- ============================================================================
-- POST COMMENT SETTINGS
-- Per-post comment configuration
-- ============================================================================
CREATE TYPE moderation_mode AS ENUM ('none', 'manual', 'auto');

CREATE TABLE public.post_comment_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    moderation moderation_mode DEFAULT 'auto',
    allow_anonymous BOOLEAN DEFAULT FALSE,
    require_approval BOOLEAN DEFAULT FALSE,
    close_after_days INTEGER DEFAULT 0 CHECK (close_after_days >= 0),
    max_depth INTEGER DEFAULT 3 CHECK (max_depth BETWEEN 1 AND 10)
);

CREATE INDEX idx_post_comment_settings_post_id ON public.post_comment_settings(post_id);

-- ============================================================================
-- POST REACTIONS
-- Reaction configuration and counts
-- ============================================================================
CREATE TABLE public.post_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    reaction_type TEXT NOT NULL,
    count INTEGER DEFAULT 0 CHECK (count >= 0),

    UNIQUE(post_id, reaction_type)
);

CREATE INDEX idx_post_reactions_post_id ON public.post_reactions(post_id);

-- ============================================================================
-- POST USER REACTIONS
-- Individual user reactions on posts
-- ============================================================================
CREATE TABLE public.post_user_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(post_id, user_id, reaction_type)
);

CREATE INDEX idx_post_user_reactions_post_id ON public.post_user_reactions(post_id);
CREATE INDEX idx_post_user_reactions_user_id ON public.post_user_reactions(user_id);

-- Trigger to update aggregate counts
CREATE OR REPLACE FUNCTION public.update_post_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.post_reactions (post_id, reaction_type, count)
        VALUES (NEW.post_id, NEW.reaction_type, 1)
        ON CONFLICT (post_id, reaction_type)
        DO UPDATE SET count = post_reactions.count + 1;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.post_reactions
        SET count = count - 1
        WHERE post_id = OLD.post_id AND reaction_type = OLD.reaction_type;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_user_reactions_count_trigger
    AFTER INSERT OR DELETE ON public.post_user_reactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_reaction_count();

-- ============================================================================
-- POST STATS
-- Engagement statistics
-- ============================================================================
CREATE TABLE public.post_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0 CHECK (views >= 0),
    unique_views INTEGER DEFAULT 0 CHECK (unique_views >= 0),
    likes INTEGER DEFAULT 0 CHECK (likes >= 0),
    shares INTEGER DEFAULT 0 CHECK (shares >= 0),
    bookmarks INTEGER DEFAULT 0 CHECK (bookmarks >= 0),
    comment_count INTEGER DEFAULT 0 CHECK (comment_count >= 0),
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_post_stats_post_id ON public.post_stats(post_id);
CREATE INDEX idx_post_stats_views ON public.post_stats(views DESC);

-- Trigger to update comment_count
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.post_stats (post_id, comment_count)
        VALUES (NEW.post_id, 1)
        ON CONFLICT (post_id)
        DO UPDATE SET comment_count = post_stats.comment_count + 1, updated_at = NOW();
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.post_stats
        SET comment_count = GREATEST(0, comment_count - 1), updated_at = NOW()
        WHERE post_id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_post_count_trigger
    AFTER INSERT OR DELETE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_comment_count();

-- ============================================================================
-- POST SPONSORSHIP
-- Sponsored content metadata
-- ============================================================================
CREATE TABLE public.post_sponsorship (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID UNIQUE NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    is_sponsored BOOLEAN DEFAULT FALSE,
    sponsor TEXT,
    disclosure_text TEXT,
    sponsor_url TEXT,
    sponsor_logo_url TEXT
);

CREATE INDEX idx_post_sponsorship_post_id ON public.post_sponsorship(post_id);
CREATE INDEX idx_post_sponsorship_is_sponsored ON public.post_sponsorship(is_sponsored) WHERE is_sponsored = TRUE;

-- ============================================================================
-- POST ATTACHMENTS
-- Downloadable files
-- ============================================================================
CREATE TABLE public.post_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER CHECK (size > 0),
    description TEXT,
    download_count INTEGER DEFAULT 0 CHECK (download_count >= 0),
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_post_attachments_post_id ON public.post_attachments(post_id, sort_order);

-- ============================================================================
-- POST BOOKMARKS
-- User bookmarks/saves
-- ============================================================================
CREATE TABLE public.post_bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_bookmarks_post_id ON public.post_bookmarks(post_id);
CREATE INDEX idx_post_bookmarks_user_id ON public.post_bookmarks(user_id);

-- Trigger to update bookmark count in stats
CREATE OR REPLACE FUNCTION public.update_post_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.post_stats (post_id, bookmarks)
        VALUES (NEW.post_id, 1)
        ON CONFLICT (post_id)
        DO UPDATE SET bookmarks = post_stats.bookmarks + 1, updated_at = NOW();
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.post_stats
        SET bookmarks = GREATEST(0, bookmarks - 1), updated_at = NOW()
        WHERE post_id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_bookmarks_count_trigger
    AFTER INSERT OR DELETE ON public.post_bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_post_bookmark_count();

-- ============================================================================
-- POST VIEWS (for unique view tracking)
-- ============================================================================
CREATE TABLE public.post_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id TEXT,
    ip_hash TEXT, -- Hashed IP for privacy
    viewed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_post_views_post_id ON public.post_views(post_id);
CREATE INDEX idx_post_views_viewed_at ON public.post_views(viewed_at DESC);
CREATE INDEX idx_post_views_unique ON public.post_views(post_id, COALESCE(user_id::text, ip_hash));

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.post_seo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_open_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_twitter_card ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_embeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_code_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_toc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_user_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sponsorship ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- Public read for most tables (content is tied to post visibility)
CREATE POLICY "SEO viewable" ON public.post_seo FOR SELECT USING (true);
CREATE POLICY "Open Graph viewable" ON public.post_open_graph FOR SELECT USING (true);
CREATE POLICY "Twitter Card viewable" ON public.post_twitter_card FOR SELECT USING (true);
CREATE POLICY "Embeds viewable" ON public.post_embeds FOR SELECT USING (true);
CREATE POLICY "Code blocks viewable" ON public.post_code_blocks FOR SELECT USING (true);
CREATE POLICY "TOC viewable" ON public.post_toc FOR SELECT USING (true);
CREATE POLICY "Comment settings viewable" ON public.post_comment_settings FOR SELECT USING (true);
CREATE POLICY "Reactions viewable" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Stats viewable" ON public.post_stats FOR SELECT USING (true);
CREATE POLICY "Sponsorship viewable" ON public.post_sponsorship FOR SELECT USING (true);
CREATE POLICY "Attachments viewable" ON public.post_attachments FOR SELECT USING (true);

-- Authors can manage their post metadata
CREATE POLICY "Authors manage SEO" ON public.post_seo FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage Open Graph" ON public.post_open_graph FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage Twitter Card" ON public.post_twitter_card FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage embeds" ON public.post_embeds FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage code blocks" ON public.post_code_blocks FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage TOC" ON public.post_toc FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage comment settings" ON public.post_comment_settings FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage sponsorship" ON public.post_sponsorship FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));
CREATE POLICY "Authors manage attachments" ON public.post_attachments FOR ALL
    USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid()));

-- User reactions: Users manage their own
CREATE POLICY "User reactions viewable" ON public.post_user_reactions FOR SELECT USING (true);
CREATE POLICY "Users manage own reactions" ON public.post_user_reactions FOR ALL
    USING (auth.uid() = user_id);

-- Bookmarks: Users manage their own
CREATE POLICY "Bookmarks viewable by owner" ON public.post_bookmarks FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users manage own bookmarks" ON public.post_bookmarks FOR ALL
    USING (auth.uid() = user_id);

-- Views: Anyone can insert, only admins can view
CREATE POLICY "Anyone can record views" ON public.post_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view analytics" ON public.post_views FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
        OR EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND author_id = auth.uid())
    );
