-- ============================================================================
-- 007_api_keys.sql
-- API Key management for blog API access
-- Supports user-scoped keys and admin keys
-- ============================================================================

-- ============================================================================
-- API KEY SCOPES
-- Defines what actions an API key can perform
-- ============================================================================
CREATE TYPE api_key_scope AS ENUM (
    'read',           -- Read-only access
    'write',          -- Create/update content
    'delete',         -- Delete content
    'admin'           -- Full administrative access
);

-- ============================================================================
-- API KEY TYPES
-- ============================================================================
CREATE TYPE api_key_type AS ENUM (
    'user',           -- User-level key, scoped to their sites
    'site',           -- Site-level key, scoped to specific site
    'admin'           -- Admin key, full database access
);

-- ============================================================================
-- API KEYS TABLE
-- ============================================================================
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Key identification
    name TEXT NOT NULL,                    -- Friendly name for the key
    description TEXT,                      -- Optional description
    key_prefix TEXT NOT NULL,              -- First 8 chars of key for identification (e.g., "sk_live_")
    key_hash TEXT NOT NULL,                -- SHA-256 hash of the full key

    -- Key type and ownership
    key_type api_key_type NOT NULL DEFAULT 'user',
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,  -- Owner of the key (null for admin keys)
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,  -- Specific site (for site-scoped keys)

    -- Permissions (array of scopes)
    scopes api_key_scope[] NOT NULL DEFAULT ARRAY['read']::api_key_scope[],

    -- Rate limiting
    rate_limit_per_minute INT DEFAULT 60,
    rate_limit_per_day INT DEFAULT 10000,

    -- Usage tracking
    last_used_at TIMESTAMPTZ,
    usage_count BIGINT DEFAULT 0,

    -- Lifecycle
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,                -- Optional expiration
    revoked_at TIMESTAMPTZ,                -- When key was revoked
    revoked_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    revoke_reason TEXT,

    -- Metadata
    allowed_ips TEXT[],                    -- IP whitelist (empty = all allowed)
    allowed_origins TEXT[],                -- CORS origins whitelist
    metadata JSONB DEFAULT '{}'::jsonb,    -- Additional metadata

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT key_prefix_format CHECK (key_prefix ~ '^[a-z]{2,4}_[a-z]+_[a-zA-Z0-9]{8}$'),
    CONSTRAINT valid_ownership CHECK (
        (key_type = 'admin' AND user_id IS NULL AND site_id IS NULL) OR
        (key_type = 'user' AND user_id IS NOT NULL) OR
        (key_type = 'site' AND site_id IS NOT NULL AND user_id IS NOT NULL)
    ),
    CONSTRAINT valid_scopes CHECK (
        (key_type != 'admin' AND NOT ('admin' = ANY(scopes))) OR
        (key_type = 'admin')
    )
);

-- Indexes
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_api_keys_site_id ON public.api_keys(site_id) WHERE site_id IS NOT NULL;
CREATE INDEX idx_api_keys_is_active ON public.api_keys(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_expires_at ON public.api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================================
-- API KEY USAGE LOG
-- Track API key usage for analytics and security
-- ============================================================================
CREATE TABLE public.api_key_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,

    -- Request info
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INT,
    response_time_ms INT,

    -- Client info
    ip_address INET,
    user_agent TEXT,
    origin TEXT,

    -- Resource accessed
    resource_type TEXT,                    -- e.g., 'post', 'comment', 'site'
    resource_id UUID,

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for usage queries
CREATE INDEX idx_api_key_usage_api_key_id ON public.api_key_usage(api_key_id);
CREATE INDEX idx_api_key_usage_created_at ON public.api_key_usage(created_at DESC);
CREATE INDEX idx_api_key_usage_api_key_created ON public.api_key_usage(api_key_id, created_at DESC);

-- Partition by month for efficient cleanup (optional, for high-volume usage)
-- This is a simple table; for production, consider partitioning

-- ============================================================================
-- API KEY SITE ACCESS
-- For user keys, track which sites they can access
-- (Beyond just their owned sites - for collaborators)
-- ============================================================================
CREATE TABLE public.api_key_site_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
    scopes api_key_scope[] NOT NULL DEFAULT ARRAY['read']::api_key_scope[],
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    UNIQUE(api_key_id, site_id)
);

CREATE INDEX idx_api_key_site_access_api_key_id ON public.api_key_site_access(api_key_id);
CREATE INDEX idx_api_key_site_access_site_id ON public.api_key_site_access(site_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to check if an API key has access to a resource
CREATE OR REPLACE FUNCTION public.api_key_has_access(
    p_key_id UUID,
    p_site_id UUID,
    p_required_scope api_key_scope
) RETURNS BOOLEAN AS $$
DECLARE
    v_key RECORD;
    v_site_access RECORD;
BEGIN
    -- Get the API key
    SELECT * INTO v_key FROM public.api_keys
    WHERE id = p_key_id AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND revoked_at IS NULL;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Admin keys have full access
    IF v_key.key_type = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Check if scope is allowed on the key
    IF NOT (p_required_scope = ANY(v_key.scopes)) THEN
        RETURN FALSE;
    END IF;

    -- Site-specific key
    IF v_key.key_type = 'site' THEN
        RETURN v_key.site_id = p_site_id;
    END IF;

    -- User key - check if user owns the site or has explicit access
    IF v_key.key_type = 'user' THEN
        -- Check site ownership
        IF EXISTS (
            SELECT 1 FROM public.sites
            WHERE id = p_site_id AND owner_id = v_key.user_id
        ) THEN
            RETURN TRUE;
        END IF;

        -- Check site membership
        IF EXISTS (
            SELECT 1 FROM public.site_members
            WHERE site_id = p_site_id AND user_id = v_key.user_id
        ) THEN
            RETURN TRUE;
        END IF;

        -- Check explicit key access
        SELECT * INTO v_site_access FROM public.api_key_site_access
        WHERE api_key_id = p_key_id AND site_id = p_site_id;

        IF FOUND AND (p_required_scope = ANY(v_site_access.scopes)) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage count
CREATE OR REPLACE FUNCTION public.api_key_record_usage(
    p_key_id UUID,
    p_endpoint TEXT,
    p_method TEXT,
    p_status_code INT DEFAULT NULL,
    p_response_time_ms INT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_origin TEXT DEFAULT NULL,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Update last used and usage count
    UPDATE public.api_keys
    SET last_used_at = NOW(), usage_count = usage_count + 1
    WHERE id = p_key_id;

    -- Insert usage log
    INSERT INTO public.api_key_usage (
        api_key_id, endpoint, method, status_code, response_time_ms,
        ip_address, user_agent, origin, resource_type, resource_id
    ) VALUES (
        p_key_id, p_endpoint, p_method, p_status_code, p_response_time_ms,
        p_ip_address, p_user_agent, p_origin, p_resource_type, p_resource_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
CREATE TRIGGER api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_key_site_access ENABLE ROW LEVEL SECURITY;

-- API Keys: Users can see and manage their own keys
CREATE POLICY "Users can view own API keys"
    ON public.api_keys FOR SELECT
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
    ));

CREATE POLICY "Users can create own API keys"
    ON public.api_keys FOR INSERT
    WITH CHECK (
        (key_type = 'user' AND user_id = auth.uid()) OR
        (key_type = 'site' AND user_id = auth.uid() AND EXISTS (
            SELECT 1 FROM public.sites WHERE id = site_id AND owner_id = auth.uid()
        )) OR
        (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE))
    );

CREATE POLICY "Users can update own API keys"
    ON public.api_keys FOR UPDATE
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
    ));

CREATE POLICY "Users can delete own API keys"
    ON public.api_keys FOR DELETE
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
    ));

-- API Key Usage: Users can view usage of their own keys
CREATE POLICY "Users can view own API key usage"
    ON public.api_key_usage FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.api_keys
        WHERE id = api_key_id AND (user_id = auth.uid() OR EXISTS (
            SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
        ))
    ));

-- API Key Site Access: Users can manage access for their own keys
CREATE POLICY "Users can manage own API key site access"
    ON public.api_key_site_access FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.api_keys
        WHERE id = api_key_id AND user_id = auth.uid()
    ));

-- Admins can manage all site access
CREATE POLICY "Admins can manage all API key site access"
    ON public.api_key_site_access FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE
    ));
