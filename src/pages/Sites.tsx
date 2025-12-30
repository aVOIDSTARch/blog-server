import { type Component, createSignal, For, onMount, Show } from "solid-js";
import {
  fetchSites,
  createSite,
  updateSite,
  deleteSite,
  type Site,
  type CreateSiteData,
  type UpdateSiteData,
} from "../lib/api";

const Sites: Component = () => {
  const [sites, setSites] = createSignal<Site[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingSite, setEditingSite] = createSignal<Site | null>(null);
  const [deletingSite, setDeletingSite] = createSignal<Site | null>(null);

  // Form states
  const [formData, setFormData] = createSignal<CreateSiteData>({
    name: "",
    slug: "",
    domain: "",
    subdomain: "",
    description: "",
    tagline: "",
    is_active: true,
    is_public: true,
  });
  const [formError, setFormError] = createSignal<string | null>(null);
  const [formLoading, setFormLoading] = createSignal(false);

  const loadSites = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSites();
      setSites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadSites();
  });

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      domain: "",
      subdomain: "",
      description: "",
      tagline: "",
      is_active: true,
      is_public: true,
    });
    setFormError(null);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      slug: site.slug,
      domain: site.domain || "",
      subdomain: site.subdomain || "",
      description: site.description || "",
      tagline: site.tagline || "",
      is_active: site.is_active,
      is_public: site.is_public,
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (site: Site) => {
    setDeletingSite(site);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const data = formData();
      // Remove empty strings
      const cleanData: CreateSiteData = {
        name: data.name,
        slug: data.slug || generateSlug(data.name),
        is_active: data.is_active,
        is_public: data.is_public,
      };
      if (data.domain) cleanData.domain = data.domain;
      if (data.subdomain) cleanData.subdomain = data.subdomain;
      if (data.description) cleanData.description = data.description;
      if (data.tagline) cleanData.tagline = data.tagline;

      await createSite(cleanData);
      setShowCreateModal(false);
      resetForm();
      await loadSites();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create site");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (e: Event) => {
    e.preventDefault();
    const site = editingSite();
    if (!site) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const data = formData();
      const updateData: UpdateSiteData = {};

      // Only include changed fields
      if (data.name !== site.name) updateData.name = data.name;
      if (data.slug !== site.slug) updateData.slug = data.slug;
      if ((data.domain || null) !== site.domain) updateData.domain = data.domain || undefined;
      if ((data.subdomain || null) !== site.subdomain) updateData.subdomain = data.subdomain || undefined;
      if ((data.description || null) !== site.description) updateData.description = data.description || undefined;
      if ((data.tagline || null) !== site.tagline) updateData.tagline = data.tagline || undefined;
      if (data.is_active !== site.is_active) updateData.is_active = data.is_active;
      if (data.is_public !== site.is_public) updateData.is_public = data.is_public;

      await updateSite(site.id, updateData);
      setShowEditModal(false);
      setEditingSite(null);
      resetForm();
      await loadSites();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update site");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    const site = deletingSite();
    if (!site) return;

    setFormLoading(true);
    setFormError(null);

    try {
      await deleteSite(site.id);
      setShowDeleteModal(false);
      setDeletingSite(null);
      await loadSites();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete site");
    } finally {
      setFormLoading(false);
    }
  };

  const updateFormField = (field: keyof CreateSiteData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div class="page sites">
      <div class="page-header">
        <h2>Sites</h2>
        <button class="btn btn-primary" onClick={openCreateModal}>
          New Site
        </button>
      </div>

      <Show when={error()}>
        <div class="alert alert-danger">{error()}</div>
      </Show>

      {/* Create Modal */}
      <Show when={showCreateModal()}>
        <div class="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div class="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Create New Site</h3>
              <button class="btn btn-close" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>
            <form class="modal-body" onSubmit={handleCreate}>
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <div class="form-row">
                <div class="form-group">
                  <label for="name">Site Name *</label>
                  <input
                    type="text"
                    id="name"
                    value={formData().name}
                    onInput={(e) => {
                      updateFormField("name", e.currentTarget.value);
                      if (!formData().slug) {
                        updateFormField("slug", generateSlug(e.currentTarget.value));
                      }
                    }}
                    placeholder="My Blog"
                    required
                  />
                </div>
                <div class="form-group">
                  <label for="slug">Slug *</label>
                  <input
                    type="text"
                    id="slug"
                    value={formData().slug}
                    onInput={(e) => updateFormField("slug", e.currentTarget.value)}
                    placeholder="my-blog"
                    required
                  />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="domain">Custom Domain</label>
                  <input
                    type="text"
                    id="domain"
                    value={formData().domain}
                    onInput={(e) => updateFormField("domain", e.currentTarget.value)}
                    placeholder="blog.example.com"
                  />
                </div>
                <div class="form-group">
                  <label for="subdomain">Subdomain</label>
                  <input
                    type="text"
                    id="subdomain"
                    value={formData().subdomain}
                    onInput={(e) => updateFormField("subdomain", e.currentTarget.value)}
                    placeholder="myblog"
                  />
                </div>
              </div>
              <div class="form-group">
                <label for="tagline">Tagline</label>
                <input
                  type="text"
                  id="tagline"
                  value={formData().tagline}
                  onInput={(e) => updateFormField("tagline", e.currentTarget.value)}
                  placeholder="A short tagline for your blog"
                />
              </div>
              <div class="form-group">
                <label for="description">Description</label>
                <textarea
                  id="description"
                  value={formData().description}
                  onInput={(e) => updateFormField("description", e.currentTarget.value)}
                  placeholder="A longer description of your blog..."
                  rows={3}
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().is_active}
                      onChange={(e) => updateFormField("is_active", e.currentTarget.checked)}
                    />
                    Active
                  </label>
                </div>
                <div class="form-group">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().is_public}
                      onChange={(e) => updateFormField("is_public", e.currentTarget.checked)}
                    />
                    Public
                  </label>
                </div>
              </div>
            </form>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-primary" onClick={handleCreate} disabled={formLoading()}>
                {formLoading() ? "Creating..." : "Create Site"}
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
              <h3>Edit Site</h3>
              <button class="btn btn-close" onClick={() => setShowEditModal(false)}>
                &times;
              </button>
            </div>
            <form class="modal-body" onSubmit={handleUpdate}>
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <div class="form-row">
                <div class="form-group">
                  <label for="edit-name">Site Name *</label>
                  <input
                    type="text"
                    id="edit-name"
                    value={formData().name}
                    onInput={(e) => updateFormField("name", e.currentTarget.value)}
                    placeholder="My Blog"
                    required
                  />
                </div>
                <div class="form-group">
                  <label for="edit-slug">Slug *</label>
                  <input
                    type="text"
                    id="edit-slug"
                    value={formData().slug}
                    onInput={(e) => updateFormField("slug", e.currentTarget.value)}
                    placeholder="my-blog"
                    required
                  />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="edit-domain">Custom Domain</label>
                  <input
                    type="text"
                    id="edit-domain"
                    value={formData().domain}
                    onInput={(e) => updateFormField("domain", e.currentTarget.value)}
                    placeholder="blog.example.com"
                  />
                </div>
                <div class="form-group">
                  <label for="edit-subdomain">Subdomain</label>
                  <input
                    type="text"
                    id="edit-subdomain"
                    value={formData().subdomain}
                    onInput={(e) => updateFormField("subdomain", e.currentTarget.value)}
                    placeholder="myblog"
                  />
                </div>
              </div>
              <div class="form-group">
                <label for="edit-tagline">Tagline</label>
                <input
                  type="text"
                  id="edit-tagline"
                  value={formData().tagline}
                  onInput={(e) => updateFormField("tagline", e.currentTarget.value)}
                  placeholder="A short tagline for your blog"
                />
              </div>
              <div class="form-group">
                <label for="edit-description">Description</label>
                <textarea
                  id="edit-description"
                  value={formData().description}
                  onInput={(e) => updateFormField("description", e.currentTarget.value)}
                  placeholder="A longer description of your blog..."
                  rows={3}
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().is_active}
                      onChange={(e) => updateFormField("is_active", e.currentTarget.checked)}
                    />
                    Active
                  </label>
                </div>
                <div class="form-group">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().is_public}
                      onChange={(e) => updateFormField("is_public", e.currentTarget.checked)}
                    />
                    Public
                  </label>
                </div>
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

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteModal()}>
        <div class="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Delete Site</h3>
              <button class="btn btn-close" onClick={() => setShowDeleteModal(false)}>
                &times;
              </button>
            </div>
            <div class="modal-body">
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <p>
                Are you sure you want to delete <strong>{deletingSite()?.name}</strong>?
              </p>
              <p class="text-danger">
                This will permanently delete the site and all associated posts, categories, and tags.
                This action cannot be undone.
              </p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-danger" onClick={handleDelete} disabled={formLoading()}>
                {formLoading() ? "Deleting..." : "Delete Site"}
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
              <th>Slug</th>
              <th>Domain</th>
              <th>Status</th>
              <th>Visibility</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <Show when={sites().length === 0}>
              <tr>
                <td colspan="7" class="text-center">
                  No sites found. Create your first site to get started.
                </td>
              </tr>
            </Show>
            <For each={sites()}>
              {(site) => (
                <tr>
                  <td>
                    <strong>{site.name}</strong>
                    <Show when={site.tagline}>
                      <br />
                      <small class="text-muted">{site.tagline}</small>
                    </Show>
                  </td>
                  <td>
                    <code>{site.slug}</code>
                  </td>
                  <td>{site.domain || site.subdomain || "-"}</td>
                  <td>
                    <span class={`badge ${site.is_active ? "badge-success" : "badge-inactive"}`}>
                      {site.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <span class={`badge ${site.is_public ? "badge-info" : "badge-secondary"}`}>
                      {site.is_public ? "Public" : "Private"}
                    </span>
                  </td>
                  <td>{new Date(site.created_at).toLocaleDateString()}</td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-sm" onClick={() => openEditModal(site)}>
                        Edit
                      </button>
                      <button class="btn btn-sm btn-danger" onClick={() => openDeleteModal(site)}>
                        Delete
                      </button>
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

export default Sites;
