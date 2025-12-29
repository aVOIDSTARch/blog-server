-- ============================================================================
-- 000_run_all.sql
-- Master migration file - runs all migrations in order
-- Run this in Supabase SQL Editor to set up the complete blog schema
-- ============================================================================

-- IMPORTANT: Run these files in order in Supabase SQL Editor
-- Or use Supabase CLI: supabase db push

/*
Migration Order:
1. 001_users.sql         - User tables, badges, social links
2. 002_blog_posts.sql    - Posts, categories, tags, series, images
3. 003_comments.sql      - Comments, threading, moderation
4. 004_post_extras.sql   - SEO, embeds, code blocks, stats
5. 005_views_and_functions.sql - Views and helper functions
*/

-- ============================================================================
-- QUICK START
-- ============================================================================
--
-- Option 1: Supabase Dashboard
-- 1. Go to SQL Editor in your Supabase dashboard
-- 2. Run each file in order (001 through 005)
--
-- Option 2: Supabase CLI
-- 1. Install: npm install -g supabase
-- 2. Login: supabase login
-- 3. Link project: supabase link --project-ref YOUR_PROJECT_REF
-- 4. Push migrations: supabase db push
--
-- Option 3: psql
-- psql $DATABASE_URL -f 001_users.sql
-- psql $DATABASE_URL -f 002_blog_posts.sql
-- psql $DATABASE_URL -f 003_comments.sql
-- psql $DATABASE_URL -f 004_post_extras.sql
-- psql $DATABASE_URL -f 005_views_and_functions.sql

-- ============================================================================
-- SCHEMA OVERVIEW
-- ============================================================================
/*
USERS & AUTH
├── users                    - User profiles (linked to auth.users)
├── user_social_links        - Social media links
├── badges                   - Badge definitions
└── user_badges              - User badge assignments

BLOG POSTS
├── posts                    - Main posts table
├── categories               - Post categories
├── tags                     - Post tags
├── series                   - Multi-part series
├── images                   - Reusable images
├── image_thumbnails         - Image variants
├── post_coauthors           - Co-author relationships
├── post_categories          - Post-category junction
├── post_tags                - Post-tag junction
├── post_images              - Post image gallery
├── post_translations        - Translation links
├── related_posts            - Related post links
├── post_navigation          - Prev/next links
└── post_revisions           - Revision history

POST EXTRAS
├── post_seo                 - SEO metadata
├── post_open_graph          - OG metadata
├── post_twitter_card        - Twitter card metadata
├── post_embeds              - External embeds
├── post_code_blocks         - Code snippets
├── post_toc                 - Table of contents
├── post_comment_settings    - Comment configuration
├── post_reactions           - Reaction counts
├── post_user_reactions      - Individual reactions
├── post_stats               - View/engagement stats
├── post_sponsorship         - Sponsored content
├── post_attachments         - Downloadable files
├── post_bookmarks           - User bookmarks
└── post_views               - View tracking

COMMENTS
├── comments                 - Comment content
├── comment_edit_history     - Edit tracking
├── comment_reactions        - Reaction counts
├── comment_user_reactions   - Individual reactions
├── comment_mentions         - @mentions
├── comment_attachments      - Media attachments
├── comment_flags            - User reports
├── comment_moderator_notes  - Mod notes
├── comment_moderation_actions - Action log
├── comment_metadata         - Technical metadata
└── comment_notifications    - Notification prefs

VIEWS
├── v_user_profiles          - Full user with badges/social
├── v_posts                  - Full post with author/stats
├── v_post_taxonomy          - Post categories/tags
└── v_comments               - Comments with author info

FUNCTIONS
├── get_post_by_slug()       - Fetch post by slug
├── get_published_posts()    - Paginated post list
├── get_post_comments()      - Threaded comments
├── increment_post_views()   - Track views
├── search_posts()           - Full-text search
├── get_related_posts()      - Related content
└── calculate_reading_time() - Auto reading time
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after migration to verify setup:

-- Check all tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;

-- Check all views exist
-- SELECT table_name FROM information_schema.views
-- WHERE table_schema = 'public' ORDER BY table_name;

-- Check all functions exist
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
-- ORDER BY routine_name;

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = true;
