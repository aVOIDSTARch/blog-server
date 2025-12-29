import { type Component, createSignal, onMount } from "solid-js";

const Dashboard: Component = () => {
  const [stats, setStats] = createSignal({
    sites: 0,
    posts: 0,
    users: 0,
    apiKeys: 0,
  });

  onMount(() => {
    // TODO: Fetch actual stats from API
    setStats({
      sites: 3,
      posts: 42,
      users: 15,
      apiKeys: 8,
    });
  });

  return (
    <div class="page dashboard">
      <h2>Dashboard</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Sites</h3>
          <p class="stat-value">{stats().sites}</p>
        </div>
        <div class="stat-card">
          <h3>Posts</h3>
          <p class="stat-value">{stats().posts}</p>
        </div>
        <div class="stat-card">
          <h3>Users</h3>
          <p class="stat-value">{stats().users}</p>
        </div>
        <div class="stat-card">
          <h3>API Keys</h3>
          <p class="stat-value">{stats().apiKeys}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
