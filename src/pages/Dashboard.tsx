import { type Component, createSignal, onMount, Show } from "solid-js";
import { A } from "@solidjs/router";
import { fetchSites, fetchAllPosts, fetchUsers, fetchApiKeys } from "../lib/api";

interface DashboardStats {
  sites: number;
  posts: number;
  publishedPosts: number;
  draftPosts: number;
  users: number;
  apiKeys: number;
  activeApiKeys: number;
}

const Dashboard: Component = () => {
  const [stats, setStats] = createSignal<DashboardStats>({
    sites: 0,
    posts: 0,
    publishedPosts: 0,
    draftPosts: 0,
    users: 0,
    apiKeys: 0,
    activeApiKeys: 0,
  });
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const [sites, posts, users, apiKeys] = await Promise.all([
        fetchSites().catch(() => []),
        fetchAllPosts().catch(() => []),
        fetchUsers().catch(() => []),
        fetchApiKeys().catch(() => []),
      ]);

      const publishedPosts = posts.filter((p) => p.status === "published").length;
      const draftPosts = posts.filter((p) => p.status === "draft").length;
      const activeApiKeys = apiKeys.filter((k) => k.is_active).length;

      setStats({
        sites: sites.length,
        posts: posts.length,
        publishedPosts,
        draftPosts,
        users: users.length,
        apiKeys: apiKeys.length,
        activeApiKeys,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard stats");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadStats();
  });

  return (
    <div class="page dashboard">
      <h2>Dashboard</h2>

      <Show when={error()}>
        <div class="alert alert-danger">{error()}</div>
      </Show>

      {loading() ? (
        <div class="loading-spinner">Loading...</div>
      ) : (
        <>
          <div class="stats-grid">
            <A href="/sites" class="stat-card stat-card-link">
              <h3>Sites</h3>
              <p class="stat-value">{stats().sites}</p>
              <p class="stat-description">Total blog sites</p>
            </A>
            <A href="/posts" class="stat-card stat-card-link">
              <h3>Posts</h3>
              <p class="stat-value">{stats().posts}</p>
              <p class="stat-description">
                {stats().publishedPosts} published, {stats().draftPosts} drafts
              </p>
            </A>
            <A href="/users" class="stat-card stat-card-link">
              <h3>Users</h3>
              <p class="stat-value">{stats().users}</p>
              <p class="stat-description">Registered users</p>
            </A>
            <A href="/api-keys" class="stat-card stat-card-link">
              <h3>API Keys</h3>
              <p class="stat-value">{stats().apiKeys}</p>
              <p class="stat-description">{stats().activeApiKeys} active keys</p>
            </A>
          </div>

          <div class="dashboard-sections">
            <div class="dashboard-section">
              <h3>Quick Actions</h3>
              <div class="quick-actions">
                <A href="/sites" class="btn btn-primary">
                  Manage Sites
                </A>
                <A href="/posts" class="btn btn-primary">
                  Manage Posts
                </A>
                <A href="/comments" class="btn btn-primary">
                  Moderate Comments
                </A>
                <A href="/api-keys" class="btn btn-secondary">
                  API Keys
                </A>
              </div>
            </div>

            <div class="dashboard-section">
              <h3>Getting Started</h3>
              <div class="getting-started">
                <div class="getting-started-item">
                  <span class="step-number">1</span>
                  <div>
                    <strong>Create a Site</strong>
                    <p>Set up your first blog site with a custom domain or subdomain.</p>
                  </div>
                </div>
                <div class="getting-started-item">
                  <span class="step-number">2</span>
                  <div>
                    <strong>Write Posts</strong>
                    <p>Create and publish blog posts in Markdown, HTML, or MDX.</p>
                  </div>
                </div>
                <div class="getting-started-item">
                  <span class="step-number">3</span>
                  <div>
                    <strong>Generate API Key</strong>
                    <p>Create an API key to integrate the blog with your frontend.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
