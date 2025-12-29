-- ============================================================================
-- 003_comments.sql
-- Comments system with threading, moderation, and reactions
-- ============================================================================

-- ============================================================================
-- COMMENT STATUS ENUM
-- ============================================================================
CREATE TYPE comment_status AS ENUM (
    'pending', 'approved', 'spam', 'rejected', 'deleted', 'flagged'
);

-- ============================================================================
-- COMMENTS TABLE
-- ============================================================================
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,

    -- Threading
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    root_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    depth INTEGER DEFAULT 0 CHECK (depth >= 0 AND depth <= 10),

    -- Author (nullable for anonymous)
    author_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Anonymous author info (when author_id is null)
    anonymous_name TEXT DEFAULT 'Anonymous',
    anonymous_email TEXT,
    anonymous_website TEXT,
    gravatar_hash TEXT,

    -- Content
    content TEXT NOT NULL,
    content_format content_format DEFAULT 'plaintext',
    content_html TEXT,

    -- Status
    status comment_status DEFAULT 'pending' NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Flags
    is_edited BOOLEAN DEFAULT FALSE,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_author_reply BOOLEAN DEFAULT FALSE,
    is_highlighted BOOLEAN DEFAULT FALSE,

    -- Cached counts
    reply_count INTEGER DEFAULT 0 CHECK (reply_count >= 0),

    -- Moderation scores
    spam_score NUMERIC(3,2) CHECK (spam_score >= 0 AND spam_score <= 1),
    toxicity_score NUMERIC(3,2) CHECK (toxicity_score >= 0 AND toxicity_score <= 1),

    -- Sentiment
    sentiment_score NUMERIC(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'neutral', 'negative', 'mixed')),

    -- Constraints
    CONSTRAINT content_length CHECK (char_length(content) BETWEEN 1 AND 10000),
    CONSTRAINT anonymous_name_length CHECK (anonymous_name IS NULL OR char_length(anonymous_name) <= 100),
    CONSTRAINT has_author CHECK (author_id IS NOT NULL OR anonymous_name IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_author_id ON public.comments(author_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX idx_comments_root_id ON public.comments(root_id);
CREATE INDEX idx_comments_status ON public.comments(status);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);
CREATE INDEX idx_comments_post_approved ON public.comments(post_id, created_at DESC) WHERE status = 'approved';

-- ============================================================================
-- COMMENT EDIT HISTORY
-- ============================================================================
CREATE TABLE public.comment_edit_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    edited_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    reason TEXT
);

CREATE INDEX idx_comment_edit_history_comment_id ON public.comment_edit_history(comment_id, edited_at DESC);

-- ============================================================================
-- COMMENT REACTIONS
-- Aggregate reaction counts per comment
-- ============================================================================
CREATE TABLE public.comment_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    count INTEGER DEFAULT 0 CHECK (count >= 0),

    UNIQUE(comment_id, reaction_type)
);

CREATE INDEX idx_comment_reactions_comment_id ON public.comment_reactions(comment_id);

-- ============================================================================
-- COMMENT USER REACTIONS
-- Individual user reactions (for tracking who reacted)
-- ============================================================================
CREATE TABLE public.comment_user_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(comment_id, user_id, reaction_type)
);

CREATE INDEX idx_comment_user_reactions_comment_id ON public.comment_user_reactions(comment_id);
CREATE INDEX idx_comment_user_reactions_user_id ON public.comment_user_reactions(user_id);

-- Trigger to update aggregate reaction counts
CREATE OR REPLACE FUNCTION public.update_comment_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.comment_reactions (comment_id, reaction_type, count)
        VALUES (NEW.comment_id, NEW.reaction_type, 1)
        ON CONFLICT (comment_id, reaction_type)
        DO UPDATE SET count = comment_reactions.count + 1;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.comment_reactions
        SET count = count - 1
        WHERE comment_id = OLD.comment_id AND reaction_type = OLD.reaction_type;

        -- Clean up zero counts
        DELETE FROM public.comment_reactions
        WHERE comment_id = OLD.comment_id AND reaction_type = OLD.reaction_type AND count <= 0;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_user_reactions_count_trigger
    AFTER INSERT OR DELETE ON public.comment_user_reactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_comment_reaction_count();

-- ============================================================================
-- COMMENT MENTIONS
-- Track @mentions in comments
-- ============================================================================
CREATE TABLE public.comment_mentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    start_index INTEGER,
    end_index INTEGER,

    UNIQUE(comment_id, user_id)
);

CREATE INDEX idx_comment_mentions_comment_id ON public.comment_mentions(comment_id);
CREATE INDEX idx_comment_mentions_user_id ON public.comment_mentions(user_id);

-- ============================================================================
-- COMMENT ATTACHMENTS
-- Media attachments on comments
-- ============================================================================
CREATE TYPE attachment_type AS ENUM ('image', 'gif', 'link', 'file');

CREATE TABLE public.comment_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    type attachment_type NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    alt TEXT,
    filename TEXT,
    mime_type TEXT,
    size INTEGER CHECK (size > 0),
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX idx_comment_attachments_comment_id ON public.comment_attachments(comment_id);

-- ============================================================================
-- COMMENT FLAGS (Reports)
-- User reports on comments
-- ============================================================================
CREATE TYPE flag_reason AS ENUM (
    'spam', 'harassment', 'hate_speech', 'misinformation',
    'off_topic', 'inappropriate', 'other'
);

CREATE TABLE public.comment_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reason flag_reason NOT NULL,
    details TEXT,
    reported_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Prevent duplicate reports
    UNIQUE(comment_id, reported_by, reason)
);

CREATE INDEX idx_comment_flags_comment_id ON public.comment_flags(comment_id);
CREATE INDEX idx_comment_flags_reported_at ON public.comment_flags(reported_at DESC);

-- ============================================================================
-- MODERATOR NOTES
-- Internal notes from moderators
-- ============================================================================
CREATE TABLE public.comment_moderator_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    moderator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_comment_moderator_notes_comment_id ON public.comment_moderator_notes(comment_id);

-- ============================================================================
-- MODERATION ACTIONS
-- Log of all moderation actions
-- ============================================================================
CREATE TYPE moderation_action AS ENUM (
    'approved', 'rejected', 'deleted', 'restored', 'edited', 'warned'
);

CREATE TABLE public.comment_moderation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    action moderation_action NOT NULL,
    moderator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_comment_moderation_actions_comment_id ON public.comment_moderation_actions(comment_id);
CREATE INDEX idx_comment_moderation_actions_timestamp ON public.comment_moderation_actions(timestamp DESC);

-- ============================================================================
-- COMMENT METADATA
-- Technical metadata for moderation
-- ============================================================================
CREATE TABLE public.comment_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID UNIQUE NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    country TEXT,
    region TEXT,
    city TEXT
);

CREATE INDEX idx_comment_metadata_comment_id ON public.comment_metadata(comment_id);
CREATE INDEX idx_comment_metadata_ip ON public.comment_metadata(ip_address);

-- ============================================================================
-- COMMENT NOTIFICATIONS
-- Notification preferences per comment
-- ============================================================================
CREATE TABLE public.comment_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID UNIQUE NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    notify_on_reply BOOLEAN DEFAULT TRUE,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ
);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update reply_count on parent when adding/removing replies
CREATE OR REPLACE FUNCTION public.update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
        UPDATE public.comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
        UPDATE public.comments SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE public.comments SET reply_count = reply_count - 1 WHERE id = OLD.parent_id;
        END IF;
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE public.comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_reply_count_trigger
    AFTER INSERT OR DELETE OR UPDATE OF parent_id ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_comment_reply_count();

-- Set root_id and depth on insert
CREATE OR REPLACE FUNCTION public.set_comment_threading()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.root_id := NEW.id;
        NEW.depth := 0;
    ELSE
        SELECT root_id, depth + 1 INTO NEW.root_id, NEW.depth
        FROM public.comments WHERE id = NEW.parent_id;

        -- Fallback if parent doesn't have root_id set
        IF NEW.root_id IS NULL THEN
            NEW.root_id := NEW.parent_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_threading_trigger
    BEFORE INSERT ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_comment_threading();

-- Check if commenter is post author
CREATE OR REPLACE FUNCTION public.set_is_author_reply()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.author_id IS NOT NULL THEN
        SELECT (author_id = NEW.author_id) INTO NEW.is_author_reply
        FROM public.posts WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comments_is_author_reply_trigger
    BEFORE INSERT ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_is_author_reply();

-- Update flag count on comments
CREATE OR REPLACE FUNCTION public.update_comment_flag_status()
RETURNS TRIGGER AS $$
DECLARE
    flag_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO flag_count FROM public.comment_flags WHERE comment_id = NEW.comment_id;

    -- Auto-flag if multiple reports
    IF flag_count >= 3 THEN
        UPDATE public.comments SET status = 'flagged' WHERE id = NEW.comment_id AND status = 'approved';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_flags_status_trigger
    AFTER INSERT ON public.comment_flags
    FOR EACH ROW
    EXECUTE FUNCTION public.update_comment_flag_status();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_user_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_moderator_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_notifications ENABLE ROW LEVEL SECURITY;

-- Comments: Approved visible to all, own comments always visible
CREATE POLICY "Approved comments are viewable"
    ON public.comments FOR SELECT
    USING (
        status = 'approved'
        OR author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.posts p
            WHERE p.id = post_id AND p.author_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
        )
    );

CREATE POLICY "Authenticated users can create comments"
    ON public.comments FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL OR anonymous_name IS NOT NULL
    );

CREATE POLICY "Users can update own comments"
    ON public.comments FOR UPDATE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
        )
    );

CREATE POLICY "Moderators can delete comments"
    ON public.comments FOR DELETE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
        )
    );

-- Edit history: Visible to comment author and moderators
CREATE POLICY "Edit history visible to author and mods"
    ON public.comment_edit_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.comments c
            WHERE c.id = comment_id AND (
                c.author_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
                )
            )
        )
    );

-- Reactions: Public read
CREATE POLICY "Reactions are viewable" ON public.comment_reactions FOR SELECT USING (true);
CREATE POLICY "User reactions are viewable" ON public.comment_user_reactions FOR SELECT USING (true);

-- Users can manage their reactions
CREATE POLICY "Users can manage reactions"
    ON public.comment_user_reactions FOR ALL
    USING (auth.uid() = user_id);

-- Mentions: Public read
CREATE POLICY "Mentions are viewable" ON public.comment_mentions FOR SELECT USING (true);

-- Attachments: Public read for approved comments
CREATE POLICY "Attachments viewable for approved comments"
    ON public.comment_attachments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.comments c
            WHERE c.id = comment_id AND c.status = 'approved'
        )
    );

-- Flags: Only moderators can view
CREATE POLICY "Moderators can view flags"
    ON public.comment_flags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
        )
    );

CREATE POLICY "Users can flag comments"
    ON public.comment_flags FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Moderator notes: Only moderators
CREATE POLICY "Moderators can manage notes"
    ON public.comment_moderator_notes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
        )
    );

-- Moderation actions: Only moderators
CREATE POLICY "Moderators can view actions"
    ON public.comment_moderation_actions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
        )
    );

CREATE POLICY "Moderators can create actions"
    ON public.comment_moderation_actions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
        )
    );

-- Metadata: Only moderators
CREATE POLICY "Moderators can view metadata"
    ON public.comment_metadata FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND (u.is_moderator OR u.is_admin)
        )
    );

-- Notifications: Comment author only
CREATE POLICY "Users can manage own notifications"
    ON public.comment_notifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.comments c
            WHERE c.id = comment_id AND c.author_id = auth.uid()
        )
    );
