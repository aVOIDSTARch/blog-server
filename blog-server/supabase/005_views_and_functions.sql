-- ============================================================================
-- 005_views_and_functions.sql
-- Useful views and helper functions for querying blog data
-- ============================================================================

-- ============================================================================
-- VIEW: Full User Profile
-- ============================================================================
CREATE OR REPLACE VIEW public.v_user_profiles AS
SELECT
    u.id,
    u.username,
    u.display_name,
    u.email,
    u.avatar_url,
    u.bio,
    u.website,
    u.is_verified,
    u.is_moderator,
    u.is_admin,
    u.reputation,
    u.created_at,
    u.updated_at,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'platform', sl.platform,
                'handle', sl.handle,
                'url', sl.url
            )
        ) FILTER (WHERE sl.id IS NOT NULL),
        '[]'::jsonb
    ) AS social_links,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'type', b.type,
                'label', b.label,
                'icon', b.icon
            )
        ) FILTER (WHERE b.id IS NOT NULL),
        '[]'::jsonb
    ) AS badges
FROM public.users u
LEFT JOIN public.user_social_links sl ON u.id = sl.user_id
LEFT JOIN public.user_badges ub ON u.id = ub.user_id
LEFT JOIN public.badges b ON ub.badge_id = b.id
GROUP BY u.id;

-- ============================================================================
-- VIEW: Full Blog Post with Author and Stats
-- ============================================================================
CREATE OR REPLACE VIEW public.v_posts AS
SELECT
    p.id,
    p.title,
    p.slug,
    p.subtitle,
    p.description,
    p.excerpt,
    p.content,
    p.content_format,
    p.status,
    p.visibility,
    p.created_at,
    p.updated_at,
    p.published_at,
    p.scheduled_at,
    p.reading_time_minutes,
    p.word_count,
    p.locale,
    p.featured,
    p.featured_order,
    p.revision,
    p.custom_fields,

    -- Author
    jsonb_build_object(
        'id', u.id,
        'name', u.display_name,
        'username', u.username,
        'email', u.email,
        'avatar', u.avatar_url,
        'bio', u.bio,
        'website', u.website
    ) AS author,

    -- Featured Image
    CASE WHEN fi.id IS NOT NULL THEN
        jsonb_build_object(
            'url', fi.url,
            'alt', fi.alt,
            'caption', fi.caption,
            'credit', fi.credit,
            'width', fi.width,
            'height', fi.height,
            'blurhash', fi.blurhash
        )
    ELSE NULL END AS featured_image,

    -- Series
    CASE WHEN s.id IS NOT NULL THEN
        jsonb_build_object(
            'id', s.id,
            'name', s.name,
            'slug', s.slug,
            'part', p.series_part,
            'totalParts', s.total_parts
        )
    ELSE NULL END AS series,

    -- Stats
    COALESCE(
        jsonb_build_object(
            'views', ps.views,
            'uniqueViews', ps.unique_views,
            'likes', ps.likes,
            'shares', ps.shares,
            'bookmarks', ps.bookmarks,
            'commentCount', ps.comment_count
        ),
        jsonb_build_object(
            'views', 0,
            'uniqueViews', 0,
            'likes', 0,
            'shares', 0,
            'bookmarks', 0,
            'commentCount', 0
        )
    ) AS stats,

    -- SEO
    CASE WHEN seo.id IS NOT NULL THEN
        jsonb_build_object(
            'metaTitle', seo.meta_title,
            'metaDescription', seo.meta_description,
            'canonicalUrl', seo.canonical_url,
            'focusKeyword', seo.focus_keyword,
            'noIndex', seo.no_index,
            'noFollow', seo.no_follow
        )
    ELSE NULL END AS seo,

    -- Reading time
    jsonb_build_object(
        'minutes', p.reading_time_minutes,
        'words', p.word_count
    ) AS reading_time

FROM public.posts p
JOIN public.users u ON p.author_id = u.id
LEFT JOIN public.images fi ON p.featured_image_id = fi.id
LEFT JOIN public.series s ON p.series_id = s.id
LEFT JOIN public.post_stats ps ON p.id = ps.post_id
LEFT JOIN public.post_seo seo ON p.id = seo.post_id;

-- ============================================================================
-- VIEW: Post with Categories and Tags
-- ============================================================================
CREATE OR REPLACE VIEW public.v_post_taxonomy AS
SELECT
    p.id AS post_id,
    COALESCE(
        array_agg(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL),
        ARRAY[]::TEXT[]
    ) AS categories,
    COALESCE(
        array_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL),
        ARRAY[]::TEXT[]
    ) AS tags
FROM public.posts p
LEFT JOIN public.post_categories pc ON p.id = pc.post_id
LEFT JOIN public.categories c ON pc.category_id = c.id
LEFT JOIN public.post_tags pt ON p.id = pt.post_id
LEFT JOIN public.tags t ON pt.tag_id = t.id
GROUP BY p.id;

-- ============================================================================
-- VIEW: Comments with Author Info
-- ============================================================================
CREATE OR REPLACE VIEW public.v_comments AS
SELECT
    c.id,
    c.post_id,
    c.parent_id,
    c.root_id,
    c.depth,
    c.content,
    c.content_format,
    c.content_html,
    c.status,
    c.created_at,
    c.updated_at,
    c.is_edited,
    c.is_pinned,
    c.is_author_reply,
    c.is_highlighted,
    c.reply_count,
    c.sentiment_score,
    c.sentiment_label,

    -- Author (registered or anonymous)
    CASE
        WHEN c.author_id IS NOT NULL THEN
            jsonb_build_object(
                'id', u.id,
                'displayName', u.display_name,
                'username', u.username,
                'avatar', u.avatar_url,
                'isRegistered', true,
                'isVerified', u.is_verified,
                'isModerator', u.is_moderator,
                'isAdmin', u.is_admin,
                'reputation', u.reputation
            )
        ELSE
            jsonb_build_object(
                'displayName', c.anonymous_name,
                'email', c.anonymous_email,
                'website', c.anonymous_website,
                'isRegistered', false,
                'gravatarHash', c.gravatar_hash
            )
    END AS author,

    -- Reactions aggregate
    COALESCE(
        (
            SELECT jsonb_object_agg(reaction_type, count)
            FROM public.comment_reactions cr
            WHERE cr.comment_id = c.id
        ),
        '{}'::jsonb
    ) AS reactions

FROM public.comments c
LEFT JOIN public.users u ON c.author_id = u.id;

-- ============================================================================
-- FUNCTION: Get Post by Slug
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_post_by_slug(post_slug TEXT)
RETURNS TABLE (
    post JSONB,
    categories TEXT[],
    tags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        to_jsonb(v.*) AS post,
        pt.categories,
        pt.tags
    FROM public.v_posts v
    JOIN public.v_post_taxonomy pt ON v.id = pt.post_id
    WHERE v.slug = post_slug
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get Published Posts (Paginated)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_published_posts(
    page_num INTEGER DEFAULT 1,
    page_size INTEGER DEFAULT 10,
    category_filter TEXT DEFAULT NULL,
    tag_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
    posts JSONB,
    total_count BIGINT,
    total_pages INTEGER
) AS $$
DECLARE
    offset_val INTEGER;
    total BIGINT;
BEGIN
    offset_val := (page_num - 1) * page_size;

    -- Get total count
    SELECT COUNT(DISTINCT p.id) INTO total
    FROM public.posts p
    LEFT JOIN public.post_categories pc ON p.id = pc.post_id
    LEFT JOIN public.categories c ON pc.category_id = c.id
    LEFT JOIN public.post_tags pt ON p.id = pt.post_id
    LEFT JOIN public.tags t ON pt.tag_id = t.id
    WHERE p.status = 'published'
      AND p.visibility = 'public'
      AND (category_filter IS NULL OR c.slug = category_filter)
      AND (tag_filter IS NULL OR t.slug = tag_filter);

    RETURN QUERY
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'id', v.id,
                'title', v.title,
                'slug', v.slug,
                'description', v.description,
                'excerpt', v.excerpt,
                'author', v.author,
                'featuredImage', v.featured_image,
                'publishedAt', v.published_at,
                'readingTime', v.reading_time,
                'stats', v.stats,
                'categories', pt.categories,
                'tags', pt.tags
            ) ORDER BY v.published_at DESC
        ) AS posts,
        total AS total_count,
        CEIL(total::NUMERIC / page_size)::INTEGER AS total_pages
    FROM (
        SELECT DISTINCT p.id, p.published_at
        FROM public.posts p
        LEFT JOIN public.post_categories pc ON p.id = pc.post_id
        LEFT JOIN public.categories c ON pc.category_id = c.id
        LEFT JOIN public.post_tags pt ON p.id = pt.post_id
        LEFT JOIN public.tags t ON pt.tag_id = t.id
        WHERE p.status = 'published'
          AND p.visibility = 'public'
          AND (category_filter IS NULL OR c.slug = category_filter)
          AND (tag_filter IS NULL OR t.slug = tag_filter)
        ORDER BY p.published_at DESC
        LIMIT page_size OFFSET offset_val
    ) filtered
    JOIN public.v_posts v ON filtered.id = v.id
    JOIN public.v_post_taxonomy pt ON v.id = pt.post_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get Comments for Post (Threaded)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_post_comments(
    p_post_id UUID,
    include_pending BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    WITH RECURSIVE comment_tree AS (
        -- Top-level comments
        SELECT
            c.*,
            0 AS level,
            ARRAY[c.created_at] AS path
        FROM public.v_comments c
        WHERE c.post_id = p_post_id
          AND c.parent_id IS NULL
          AND (c.status = 'approved' OR include_pending)

        UNION ALL

        -- Replies
        SELECT
            c.*,
            ct.level + 1,
            ct.path || c.created_at
        FROM public.v_comments c
        JOIN comment_tree ct ON c.parent_id = ct.id
        WHERE c.status = 'approved' OR include_pending
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'postId', post_id,
            'parentId', parent_id,
            'depth', depth,
            'content', content,
            'contentHtml', content_html,
            'status', status,
            'createdAt', created_at,
            'isEdited', is_edited,
            'isPinned', is_pinned,
            'isAuthorReply', is_author_reply,
            'isHighlighted', is_highlighted,
            'replyCount', reply_count,
            'author', author,
            'reactions', reactions,
            'sentiment', jsonb_build_object('score', sentiment_score, 'label', sentiment_label)
        )
        ORDER BY is_pinned DESC, path
    ) INTO result
    FROM comment_tree;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Increment View Count
-- ============================================================================
CREATE OR REPLACE FUNCTION public.increment_post_views(
    p_post_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_ip_hash TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Insert view record
    INSERT INTO public.post_views (post_id, user_id, session_id, ip_hash)
    VALUES (p_post_id, p_user_id, p_session_id, p_ip_hash);

    -- Update stats
    INSERT INTO public.post_stats (post_id, views, unique_views)
    VALUES (p_post_id, 1, 1)
    ON CONFLICT (post_id) DO UPDATE SET
        views = post_stats.views + 1,
        unique_views = post_stats.unique_views + (
            CASE WHEN NOT EXISTS (
                SELECT 1 FROM public.post_views pv
                WHERE pv.post_id = p_post_id
                  AND (
                    (p_user_id IS NOT NULL AND pv.user_id = p_user_id)
                    OR (p_ip_hash IS NOT NULL AND pv.ip_hash = p_ip_hash)
                  )
                  AND pv.viewed_at < NOW() - INTERVAL '24 hours'
            ) THEN 1 ELSE 0 END
        ),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Search Posts (Full Text)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_posts(
    search_query TEXT,
    page_num INTEGER DEFAULT 1,
    page_size INTEGER DEFAULT 10
)
RETURNS TABLE (
    posts JSONB,
    total_count BIGINT
) AS $$
DECLARE
    offset_val INTEGER;
    total BIGINT;
    tsquery_val TSQUERY;
BEGIN
    offset_val := (page_num - 1) * page_size;
    tsquery_val := plainto_tsquery('english', search_query);

    -- Count total matches
    SELECT COUNT(*) INTO total
    FROM public.posts p
    WHERE p.status = 'published'
      AND p.visibility = 'public'
      AND to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.content, ''))
          @@ tsquery_val;

    RETURN QUERY
    SELECT
        jsonb_agg(
            jsonb_build_object(
                'id', v.id,
                'title', v.title,
                'slug', v.slug,
                'description', v.description,
                'excerpt', v.excerpt,
                'author', v.author,
                'publishedAt', v.published_at,
                'readingTime', v.reading_time
            )
        ) AS posts,
        total AS total_count
    FROM (
        SELECT p.id,
               ts_rank(
                   to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.content, '')),
                   tsquery_val
               ) AS rank
        FROM public.posts p
        WHERE p.status = 'published'
          AND p.visibility = 'public'
          AND to_tsvector('english', coalesce(p.title, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.content, ''))
              @@ tsquery_val
        ORDER BY rank DESC
        LIMIT page_size OFFSET offset_val
    ) search_results
    JOIN public.v_posts v ON search_results.id = v.id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get Related Posts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_related_posts(
    p_post_id UUID,
    limit_count INTEGER DEFAULT 5
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- First try manual related posts, then fall back to tag-based
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', v.id,
            'title', v.title,
            'slug', v.slug,
            'description', v.description,
            'featuredImage', v.featured_image,
            'publishedAt', v.published_at
        )
    ) INTO result
    FROM (
        -- Manual related posts
        SELECT rp.related_post_id AS id, rp.sort_order
        FROM public.related_posts rp
        WHERE rp.post_id = p_post_id

        UNION

        -- Tag-based related posts (if manual aren't enough)
        SELECT p.id, 1000 + ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) AS sort_order
        FROM public.posts p
        JOIN public.post_tags pt ON p.id = pt.post_id
        WHERE pt.tag_id IN (
            SELECT tag_id FROM public.post_tags WHERE post_id = p_post_id
        )
        AND p.id != p_post_id
        AND p.status = 'published'
        AND p.visibility = 'public'
        AND p.id NOT IN (
            SELECT related_post_id FROM public.related_posts WHERE post_id = p_post_id
        )
        GROUP BY p.id

        ORDER BY sort_order
        LIMIT limit_count
    ) related
    JOIN public.v_posts v ON related.id = v.id
    WHERE v.status = 'published' AND v.visibility = 'public';

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Calculate Reading Time
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_reading_time(content_text TEXT)
RETURNS TABLE (minutes INTEGER, words INTEGER) AS $$
DECLARE
    word_count INTEGER;
    wpm INTEGER := 200; -- Average reading speed
BEGIN
    -- Count words (split by whitespace)
    word_count := array_length(regexp_split_to_array(content_text, '\s+'), 1);

    RETURN QUERY SELECT
        GREATEST(1, CEIL(word_count::NUMERIC / wpm))::INTEGER AS minutes,
        word_count AS words;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-calculate reading time on post save
CREATE OR REPLACE FUNCTION public.auto_calculate_reading_time()
RETURNS TRIGGER AS $$
DECLARE
    rt RECORD;
BEGIN
    SELECT * INTO rt FROM public.calculate_reading_time(NEW.content);
    NEW.reading_time_minutes := rt.minutes;
    NEW.word_count := rt.words;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_calculate_reading_time
    BEFORE INSERT OR UPDATE OF content ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_calculate_reading_time();
