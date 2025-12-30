import { type Component, createSignal, For, onMount, Show } from "solid-js";
import {
  fetchApiKeys,
  fetchSites,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  type ApiKey,
  type Site,
  type CreateApiKeyData,
  type UpdateApiKeyData,
} from "../lib/api";

const ApiKeys: Component = () => {
  const [apiKeys, setApiKeys] = createSignal<ApiKey[]>([]);
  const [sites, setSites] = createSignal<Site[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showRevokeModal, setShowRevokeModal] = createSignal(false);
  const [showKeyModal, setShowKeyModal] = createSignal(false);
  const [editingKey, setEditingKey] = createSignal<ApiKey | null>(null);
  const [revokingKey, setRevokingKey] = createSignal<ApiKey | null>(null);
  const [newKeyValue, setNewKeyValue] = createSignal<string>("");

  // Form states
  const [formData, setFormData] = createSignal<CreateApiKeyData>({
    name: "",
    description: "",
    key_type: "user",
    site_id: "",
    scopes: ["read"],
    expires_at: "",
  });
  const [revokeReason, setRevokeReason] = createSignal("");
  const [formError, setFormError] = createSignal<string | null>(null);
  const [formLoading, setFormLoading] = createSignal(false);

  const loadSites = async () => {
    try {
      const data = await fetchSites();
      setSites(data);
    } catch (err) {
      console.error("Failed to load sites:", err);
    }
  };

  const loadApiKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchApiKeys();
      setApiKeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadSites();
    await loadApiKeys();
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      key_type: "user",
      site_id: "",
      scopes: ["read"],
      expires_at: "",
    });
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (key: ApiKey) => {
    setEditingKey(key);
    setFormData({
      name: key.name,
      description: key.description || "",
      key_type: key.key_type,
      site_id: key.site_id || "",
      scopes: key.scopes,
      expires_at: key.expires_at ? key.expires_at.split("T")[0] : "",
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openRevokeModal = (key: ApiKey) => {
    setRevokingKey(key);
    setRevokeReason("");
    setShowRevokeModal(true);
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const data = formData();
      const keyData: CreateApiKeyData = {
        name: data.name,
        key_type: data.key_type,
        scopes: data.scopes,
      };
      if (data.description) keyData.description = data.description;
      if (data.site_id && data.key_type === "site") keyData.site_id = data.site_id;
      if (data.expires_at) keyData.expires_at = new Date(data.expires_at).toISOString();

      const result = await createApiKey(keyData);
      setShowCreateModal(false);
      resetForm();

      // Show the new key to the user
      setNewKeyValue(result.key);
      setShowKeyModal(true);

      await loadApiKeys();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (e: Event) => {
    e.preventDefault();
    const key = editingKey();
    if (!key) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const data = formData();
      const updateData: UpdateApiKeyData = {};

      if (data.name !== key.name) updateData.name = data.name;
      if ((data.description || null) !== key.description) updateData.description = data.description || undefined;
      if (JSON.stringify(data.scopes) !== JSON.stringify(key.scopes)) updateData.scopes = data.scopes;
      const currentExpiry = key.expires_at ? key.expires_at.split("T")[0] : "";
      if (data.expires_at !== currentExpiry) {
        updateData.expires_at = data.expires_at ? new Date(data.expires_at).toISOString() : null;
      }

      await updateApiKey(key.id, updateData);
      setShowEditModal(false);
      setEditingKey(null);
      resetForm();
      await loadApiKeys();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update API key");
    } finally {
      setFormLoading(false);
    }
  };

  const handleRevoke = async () => {
    const key = revokingKey();
    if (!key) return;

    setFormLoading(true);
    setFormError(null);

    try {
      await revokeApiKey(key.id, revokeReason() || undefined);
      setShowRevokeModal(false);
      setRevokingKey(null);
      setRevokeReason("");
      await loadApiKeys();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to revoke API key");
    } finally {
      setFormLoading(false);
    }
  };

  const updateFormField = <K extends keyof CreateApiKeyData>(field: K, value: CreateApiKeyData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleScope = (scope: "read" | "write" | "delete" | "admin") => {
    const currentScopes = formData().scopes || [];
    if (currentScopes.includes(scope)) {
      updateFormField(
        "scopes",
        currentScopes.filter((s) => s !== scope)
      );
    } else {
      updateFormField("scopes", [...currentScopes, scope]);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const getKeyTypeClass = (type: ApiKey["key_type"]) => {
    switch (type) {
      case "admin":
        return "badge-danger";
      case "site":
        return "badge-info";
      case "user":
        return "badge-primary";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div class="page api-keys">
      <div class="page-header">
        <h2>API Keys</h2>
        <button class="btn btn-primary" onClick={openCreateModal}>
          New API Key
        </button>
      </div>

      <Show when={error()}>
        <div class="alert alert-danger">{error()}</div>
      </Show>

      {/* New Key Display Modal */}
      <Show when={showKeyModal()}>
        <div class="modal-overlay" onClick={() => setShowKeyModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>API Key Created</h3>
              <button class="btn btn-close" onClick={() => setShowKeyModal(false)}>
                &times;
              </button>
            </div>
            <div class="modal-body">
              <div class="alert alert-warning">
                Make sure to copy your API key now. You won't be able to see it again!
              </div>
              <div class="key-display">
                <code class="key-value">{newKeyValue()}</code>
                <button class="btn btn-sm" onClick={() => copyToClipboard(newKeyValue())}>
                  Copy
                </button>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary" onClick={() => setShowKeyModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Create Modal */}
      <Show when={showCreateModal()}>
        <div class="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div class="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Create New API Key</h3>
              <button class="btn btn-close" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>
            <form class="modal-body" onSubmit={handleCreate}>
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <div class="form-group">
                <label for="name">Key Name *</label>
                <input
                  type="text"
                  id="name"
                  value={formData().name}
                  onInput={(e) => updateFormField("name", e.currentTarget.value)}
                  placeholder="My API Key"
                  required
                />
              </div>
              <div class="form-group">
                <label for="description">Description</label>
                <input
                  type="text"
                  id="description"
                  value={formData().description}
                  onInput={(e) => updateFormField("description", e.currentTarget.value)}
                  placeholder="Optional description"
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="type">Key Type</label>
                  <select
                    id="type"
                    value={formData().key_type}
                    onChange={(e) => updateFormField("key_type", e.currentTarget.value as CreateApiKeyData["key_type"])}
                  >
                    <option value="user">User Key (sk_*)</option>
                    <option value="site">Site Key (ss_*)</option>
                    <option value="admin">Admin Key (sa_*)</option>
                  </select>
                </div>
                <Show when={formData().key_type === "site"}>
                  <div class="form-group">
                    <label for="site">Site</label>
                    <select
                      id="site"
                      value={formData().site_id}
                      onChange={(e) => updateFormField("site_id", e.currentTarget.value)}
                    >
                      <option value="">Select a site</option>
                      <For each={sites()}>
                        {(site) => <option value={site.id}>{site.name}</option>}
                      </For>
                    </select>
                  </div>
                </Show>
              </div>
              <div class="form-group">
                <label>Scopes</label>
                <div class="checkbox-group">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().scopes?.includes("read")}
                      onChange={() => toggleScope("read")}
                    />
                    Read
                  </label>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().scopes?.includes("write")}
                      onChange={() => toggleScope("write")}
                    />
                    Write
                  </label>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().scopes?.includes("delete")}
                      onChange={() => toggleScope("delete")}
                    />
                    Delete
                  </label>
                  <Show when={formData().key_type === "admin"}>
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData().scopes?.includes("admin")}
                        onChange={() => toggleScope("admin")}
                      />
                      Admin
                    </label>
                  </Show>
                </div>
              </div>
              <div class="form-group">
                <label for="expires">Expires At (optional)</label>
                <input
                  type="date"
                  id="expires"
                  value={formData().expires_at}
                  onInput={(e) => updateFormField("expires_at", e.currentTarget.value)}
                />
              </div>
            </form>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-primary" onClick={handleCreate} disabled={formLoading()}>
                {formLoading() ? "Creating..." : "Create Key"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Edit Modal */}
      <Show when={showEditModal()}>
        <div class="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div class="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Edit API Key</h3>
              <button class="btn btn-close" onClick={() => setShowEditModal(false)}>
                &times;
              </button>
            </div>
            <form class="modal-body" onSubmit={handleUpdate}>
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <div class="form-group">
                <label>Key Prefix</label>
                <p class="form-text">
                  <code>{editingKey()?.key_prefix}</code>
                </p>
              </div>
              <div class="form-group">
                <label for="edit-name">Key Name *</label>
                <input
                  type="text"
                  id="edit-name"
                  value={formData().name}
                  onInput={(e) => updateFormField("name", e.currentTarget.value)}
                  placeholder="My API Key"
                  required
                />
              </div>
              <div class="form-group">
                <label for="edit-description">Description</label>
                <input
                  type="text"
                  id="edit-description"
                  value={formData().description}
                  onInput={(e) => updateFormField("description", e.currentTarget.value)}
                  placeholder="Optional description"
                />
              </div>
              <div class="form-group">
                <label>Scopes</label>
                <div class="checkbox-group">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().scopes?.includes("read")}
                      onChange={() => toggleScope("read")}
                    />
                    Read
                  </label>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().scopes?.includes("write")}
                      onChange={() => toggleScope("write")}
                    />
                    Write
                  </label>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().scopes?.includes("delete")}
                      onChange={() => toggleScope("delete")}
                    />
                    Delete
                  </label>
                  <Show when={editingKey()?.key_type === "admin"}>
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData().scopes?.includes("admin")}
                        onChange={() => toggleScope("admin")}
                      />
                      Admin
                    </label>
                  </Show>
                </div>
              </div>
              <div class="form-group">
                <label for="edit-expires">Expires At</label>
                <input
                  type="date"
                  id="edit-expires"
                  value={formData().expires_at}
                  onInput={(e) => updateFormField("expires_at", e.currentTarget.value)}
                />
              </div>
            </form>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowEditModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-primary" onClick={handleUpdate} disabled={formLoading()}>
                {formLoading() ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Revoke Modal */}
      <Show when={showRevokeModal()}>
        <div class="modal-overlay" onClick={() => setShowRevokeModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Revoke API Key</h3>
              <button class="btn btn-close" onClick={() => setShowRevokeModal(false)}>
                &times;
              </button>
            </div>
            <div class="modal-body">
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <p>
                Are you sure you want to revoke <strong>{revokingKey()?.name}</strong>?
              </p>
              <p class="text-danger">This action cannot be undone. Any applications using this key will lose access.</p>
              <div class="form-group">
                <label for="reason">Reason (optional)</label>
                <input
                  type="text"
                  id="reason"
                  value={revokeReason()}
                  onInput={(e) => setRevokeReason(e.currentTarget.value)}
                  placeholder="Why is this key being revoked?"
                />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowRevokeModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-danger" onClick={handleRevoke} disabled={formLoading()}>
                {formLoading() ? "Revoking..." : "Revoke Key"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {loading() ? (
        <div class="loading-spinner">Loading...</div>
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
            <Show when={apiKeys().length === 0}>
              <tr>
                <td colspan="9" class="text-center">
                  No API keys found. Create your first API key to get started.
                </td>
              </tr>
            </Show>
            <For each={apiKeys()}>
              {(key) => (
                <tr>
                  <td>
                    <strong>{key.name}</strong>
                    <Show when={key.description}>
                      <br />
                      <small class="text-muted">{key.description}</small>
                    </Show>
                  </td>
                  <td>
                    <code>{key.key_prefix}</code>
                  </td>
                  <td>
                    <span class={`badge ${getKeyTypeClass(key.key_type)}`}>{key.key_type}</span>
                  </td>
                  <td>{key.scopes.join(", ")}</td>
                  <td>
                    <span class={`badge ${key.is_active ? "badge-success" : "badge-inactive"}`}>
                      {key.is_active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td>{key.usage_count.toLocaleString()}</td>
                  <td>{formatDate(key.last_used_at)}</td>
                  <td>{formatDate(key.expires_at)}</td>
                  <td>
                    <div class="btn-group">
                      <Show when={key.is_active}>
                        <button class="btn btn-sm" onClick={() => openEditModal(key)}>
                          Edit
                        </button>
                        <button class="btn btn-sm btn-danger" onClick={() => openRevokeModal(key)}>
                          Revoke
                        </button>
                      </Show>
                      <Show when={!key.is_active}>
                        <span class="text-muted">Revoked</span>
                      </Show>
                    </div>
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
