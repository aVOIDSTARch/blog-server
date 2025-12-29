import { type Component, createSignal, For, onMount } from "solid-js";

interface Site {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  isActive: boolean;
  createdAt: string;
}

const Sites: Component = () => {
  const [sites, setSites] = createSignal<Site[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    // TODO: Fetch actual sites from API
    setSites([
      {
        id: "1",
        name: "Tech Blog",
        slug: "tech-blog",
        domain: "tech.example.com",
        isActive: true,
        createdAt: "2024-01-15",
      },
      {
        id: "2",
        name: "Personal Blog",
        slug: "personal",
        domain: null,
        isActive: true,
        createdAt: "2024-02-20",
      },
    ]);
    setLoading(false);
  });

  return (
    <div class="page sites">
      <div class="page-header">
        <h2>Sites</h2>
        <button class="btn btn-primary">New Site</button>
      </div>

      {loading() ? (
        <p>Loading...</p>
      ) : (
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Domain</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={sites()}>
              {(site) => (
                <tr>
                  <td>{site.name}</td>
                  <td>{site.slug}</td>
                  <td>{site.domain || "-"}</td>
                  <td>
                    <span
                      class={`badge ${site.isActive ? "badge-success" : "badge-inactive"}`}
                    >
                      {site.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{site.createdAt}</td>
                  <td>
                    <button class="btn btn-sm">Edit</button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Sites;
