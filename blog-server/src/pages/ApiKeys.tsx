import { type Component, createSignal, For, onMount, Show } from "solid-js";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  keyType: "user" | "site" | "admin";
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
  expiresAt: string | null;
}

const ApiKeys: Component = () => {
  const [apiKeys, setApiKeys] = createSignal<ApiKey[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [showCreateModal, setShowCreateModal] = createSignal(false);

  onMount(() => {
    // TODO: Fetch actual API keys from API
    setApiKeys([
      {
        id: "1",
        name: "Production Key",
        keyPrefix: "sk_live_abc12345",
        keyType: "user",
        scopes: ["read", "write"],
        isActive: true,
        lastUsedAt: "2024-03-20",
        usageCount: 1523,
        createdAt: "2024-01-15",
        expiresAt: null,
      },
      {
        id: "2",
        name: "Admin Key",
        keyPrefix: "sa_live_xyz98765",
        keyType: "admin",
        scopes: ["admin"],
        isActive: true,
        lastUsedAt: "2024-03-19",
        usageCount: 89,
        createdAt: "2024-02-01",
        expiresAt: "2025-02-01",
      },
      {
        id: "3",
        name: "Site Key - Tech Blog",
        keyPrefix: "ss_live_def45678",
        keyType: "site",
        scopes: ["read"],
        isActive: false,
        lastUsedAt: null,
        usageCount: 0,
        createdAt: "2024-03-01",
        expiresAt: null,
      },
    ]);
    setLoading(false);
  });

  const getKeyTypeClass = (type: ApiKey["keyType"]) => {
    switch (type) {
      case "admin":
        return "badge-danger";
      case "site":
        return "badge-info";
      case "user":
        return "badge-primary";
    }
  };

  return (
    <div class="page api-keys">
      <div class="page-header">
        <h2>API Keys</h2>
        <button class="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          New API Key
        </button>
      </div>

      <Show when={showCreateModal()}>
        <div class="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Create New API Key</h3>
              <button
                class="btn btn-close"
                onClick={() => setShowCreateModal(false)}
              >
                &times;
              </button>
            </div>
            <form class="modal-body">
              <div class="form-group">
                <label for="name">Key Name</label>
                <input type="text" id="name" placeholder="My API Key" />
              </div>
              <div class="form-group">
                <label for="type">Key Type</label>
                <select id="type">
                  <option value="user">User Key</option>
                  <option value="site">Site Key</option>
                  <option value="admin">Admin Key</option>
                </select>
              </div>
              <div class="form-group">
                <label>Scopes</label>
                <div class="checkbox-group">
                  <label>
                    <input type="checkbox" value="read" checked /> Read
                  </label>
                  <label>
                    <input type="checkbox" value="write" /> Write
                  </label>
                  <label>
                    <input type="checkbox" value="delete" /> Delete
                  </label>
                </div>
              </div>
              <div class="form-group">
                <label for="expires">Expires At (optional)</label>
                <input type="date" id="expires" />
              </div>
            </form>
            <div class="modal-footer">
              <button
                class="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button class="btn btn-primary">Create Key</button>
            </div>
          </div>
        </div>
      </Show>

      {loading() ? (
        <p>Loading...</p>
      ) : (
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Key Prefix</th>
              <th>Type</th>
              <th>Scopes</th>
              <th>Status</th>
              <th>Usage</th>
              <th>Last Used</th>
              <th>Expires</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={apiKeys()}>
              {(key) => (
                <tr>
                  <td>{key.name}</td>
                  <td>
                    <code>{key.keyPrefix}</code>
                  </td>
                  <td>
                    <span class={`badge ${getKeyTypeClass(key.keyType)}`}>
                      {key.keyType}
                    </span>
                  </td>
                  <td>{key.scopes.join(", ")}</td>
                  <td>
                    <span
                      class={`badge ${key.isActive ? "badge-success" : "badge-inactive"}`}
                    >
                      {key.isActive ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td>{key.usageCount.toLocaleString()}</td>
                  <td>{key.lastUsedAt || "Never"}</td>
                  <td>{key.expiresAt || "Never"}</td>
                  <td>
                    <Show when={key.isActive}>
                      <button class="btn btn-sm btn-danger">Revoke</button>
                    </Show>
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

export default ApiKeys;
