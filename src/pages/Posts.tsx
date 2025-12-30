import { type Component, createSignal, For, onMount, Show } from "solid-js";
import {
  fetchSites,
  fetchPosts,
  fetchAllPosts,
  createPost,
  updatePost,
  deletePost,
  type Site,
  type Post,
  type CreatePostData,
  type UpdatePostData,
} from "../lib/api";

const Posts: Component = () => {
  const [posts, setPosts] = createSignal<Post[]>([]);
  const [sites, setSites] = createSignal<Site[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Filter state
  const [selectedSiteId, setSelectedSiteId] = createSignal<string>("");

  // Modal states
  const [showCreateModal, setShowCreateModal] = createSignal(false);
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingPost, setEditingPost] = createSignal<Post | null>(null);
  const [deletingPost, setDeletingPost] = createSignal<Post | null>(null);

  // Form states
  const [formData, setFormData] = createSignal<CreatePostData & { site_id: string }>({
    site_id: "",
    title: "",
    slug: "",
    content: "",
    subtitle: "",
    description: "",
    excerpt: "",
    content_format: "markdown",
    status: "draft",
    visibility: "public",
    featured: false,
  });
  const [formError, setFormError] = createSignal<string | null>(null);
  const [formLoading, setFormLoading] = createSignal(false);

  const loadSites = async () => {
    try {
      const data = await fetchSites();
      setSites(data);
      return data;
    } catch (err) {
      console.error("Failed to load sites:", err);
      return [];
    }
  };

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const siteId = selectedSiteId();
      let data: Post[];

      if (siteId) {
        data = await fetchPosts(siteId);
      } else {
        data = await fetchAllPosts();
      }

      setPosts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadSites();
    await loadPosts();
  });

  const resetForm = () => {
    const sitesList = sites();
    setFormData({
      site_id: sitesList.length > 0 ? sitesList[0].id : "",
      title: "",
      slug: "",
      content: "",
      subtitle: "",
      description: "",
      excerpt: "",
      content_format: "markdown",
      status: "draft",
      visibility: "public",
      featured: false,
    });
    setFormError(null);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = (post: Post) => {
    setEditingPost(post);
    setFormData({
      site_id: post.site_id || "",
      title: post.title,
      slug: post.slug,
      content: post.content,
      subtitle: post.subtitle || "",
      description: post.description || "",
      excerpt: post.excerpt || "",
      content_format: post.content_format,
      status: post.status === "pending_review" ? "draft" : post.status as "draft" | "published" | "scheduled",
      visibility: post.visibility,
      featured: post.featured,
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (post: Post) => {
    setDeletingPost(post);
    setShowDeleteModal(true);
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const data = formData();
      if (!data.site_id) {
        setFormError("Please select a site");
        return;
      }

      const postData: CreatePostData = {
        title: data.title,
        slug: data.slug || generateSlug(data.title),
        content: data.content,
        content_format: data.content_format,
        status: data.status,
        visibility: data.visibility,
        featured: data.featured,
      };
      if (data.subtitle) postData.subtitle = data.subtitle;
      if (data.description) postData.description = data.description;
      if (data.excerpt) postData.excerpt = data.excerpt;

      await createPost(data.site_id, postData);
      setShowCreateModal(false);
      resetForm();
      await loadPosts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdate = async (e: Event) => {
    e.preventDefault();
    const post = editingPost();
    if (!post) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const data = formData();
      const updateData: UpdatePostData = {};

      // Only include changed fields
      if (data.title !== post.title) updateData.title = data.title;
      if (data.slug !== post.slug) updateData.slug = data.slug;
      if (data.content !== post.content) updateData.content = data.content;
      if ((data.subtitle || null) !== post.subtitle) updateData.subtitle = data.subtitle || undefined;
      if ((data.description || null) !== post.description) updateData.description = data.description || undefined;
      if ((data.excerpt || null) !== post.excerpt) updateData.excerpt = data.excerpt || undefined;
      if (data.content_format !== post.content_format) updateData.content_format = data.content_format;
      if (data.status !== post.status) updateData.status = data.status;
      if (data.visibility !== post.visibility) updateData.visibility = data.visibility;
      if (data.featured !== post.featured) updateData.featured = data.featured;

      await updatePost(post.id, updateData);
      setShowEditModal(false);
      setEditingPost(null);
      resetForm();
      await loadPosts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update post");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    const post = deletingPost();
    if (!post) return;

    setFormLoading(true);
    setFormError(null);

    try {
      await deletePost(post.id);
      setShowDeleteModal(false);
      setDeletingPost(null);
      await loadPosts();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete post");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSiteFilterChange = async (siteId: string) => {
    setSelectedSiteId(siteId);
    await loadPosts();
  };

  const updateFormField = <K extends keyof (CreatePostData & { site_id: string })>(
    field: K,
    value: (CreatePostData & { site_id: string })[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getStatusClass = (status: Post["status"]) => {
    switch (status) {
      case "published":
        return "badge-success";
      case "draft":
        return "badge-warning";
      case "pending_review":
        return "badge-info";
      case "scheduled":
        return "badge-primary";
      case "archived":
      case "deleted":
        return "badge-inactive";
      default:
        return "badge-secondary";
    }
  };

  const getSiteName = (siteId: string | null) => {
    if (!siteId) return "-";
    const site = sites().find((s) => s.id === siteId);
    return site?.name || "-";
  };

  return (
    <div class="page posts">
      <div class="page-header">
        <h2>Posts</h2>
        <div class="page-header-actions">
          <select
            class="form-select"
            value={selectedSiteId()}
            onChange={(e) => handleSiteFilterChange(e.currentTarget.value)}
          >
            <option value="">All Sites</option>
            <For each={sites()}>
              {(site) => <option value={site.id}>{site.name}</option>}
            </For>
          </select>
          <button class="btn btn-primary" onClick={openCreateModal}>
            New Post
          </button>
        </div>
      </div>

      <Show when={error()}>
        <div class="alert alert-danger">{error()}</div>
      </Show>

      {/* Create Modal */}
      <Show when={showCreateModal()}>
        <div class="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div class="modal modal-xl" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Create New Post</h3>
              <button class="btn btn-close" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>
            <form class="modal-body" onSubmit={handleCreate}>
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <div class="form-group">
                <label for="site">Site *</label>
                <select
                  id="site"
                  value={formData().site_id}
                  onChange={(e) => updateFormField("site_id", e.currentTarget.value)}
                  required
                >
                  <option value="">Select a site</option>
                  <For each={sites()}>
                    {(site) => <option value={site.id}>{site.name}</option>}
                  </For>
                </select>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="title">Title *</label>
                  <input
                    type="text"
                    id="title"
                    value={formData().title}
                    onInput={(e) => {
                      updateFormField("title", e.currentTarget.value);
                      if (!formData().slug) {
                        updateFormField("slug", generateSlug(e.currentTarget.value));
                      }
                    }}
                    placeholder="Post title"
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
                    placeholder="post-slug"
                    required
                  />
                </div>
              </div>
              <div class="form-group">
                <label for="subtitle">Subtitle</label>
                <input
                  type="text"
                  id="subtitle"
                  value={formData().subtitle}
                  onInput={(e) => updateFormField("subtitle", e.currentTarget.value)}
                  placeholder="Optional subtitle"
                />
              </div>
              <div class="form-group">
                <label for="excerpt">Excerpt</label>
                <textarea
                  id="excerpt"
                  value={formData().excerpt}
                  onInput={(e) => updateFormField("excerpt", e.currentTarget.value)}
                  placeholder="A brief excerpt for previews..."
                  rows={2}
                />
              </div>
              <div class="form-group">
                <label for="content">Content *</label>
                <textarea
                  id="content"
                  value={formData().content}
                  onInput={(e) => updateFormField("content", e.currentTarget.value)}
                  placeholder="Write your post content here..."
                  rows={10}
                  required
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="content_format">Content Format</label>
                  <select
                    id="content_format"
                    value={formData().content_format}
                    onChange={(e) =>
                      updateFormField("content_format", e.currentTarget.value as CreatePostData["content_format"])
                    }
                  >
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                    <option value="mdx">MDX</option>
                    <option value="plaintext">Plain Text</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="status">Status</label>
                  <select
                    id="status"
                    value={formData().status}
                    onChange={(e) => updateFormField("status", e.currentTarget.value as CreatePostData["status"])}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="visibility">Visibility</label>
                  <select
                    id="visibility"
                    value={formData().visibility}
                    onChange={(e) =>
                      updateFormField("visibility", e.currentTarget.value as CreatePostData["visibility"])
                    }
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="members_only">Members Only</option>
                    <option value="password_protected">Password Protected</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData().featured}
                    onChange={(e) => updateFormField("featured", e.currentTarget.checked)}
                  />
                  Featured Post
                </label>
              </div>
            </form>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-primary" onClick={handleCreate} disabled={formLoading()}>
                {formLoading() ? "Creating..." : "Create Post"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {/* Edit Modal */}
      <Show when={showEditModal()}>
        <div class="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div class="modal modal-xl" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Edit Post</h3>
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
                  <label for="edit-title">Title *</label>
                  <input
                    type="text"
                    id="edit-title"
                    value={formData().title}
                    onInput={(e) => updateFormField("title", e.currentTarget.value)}
                    placeholder="Post title"
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
                    placeholder="post-slug"
                    required
                  />
                </div>
              </div>
              <div class="form-group">
                <label for="edit-subtitle">Subtitle</label>
                <input
                  type="text"
                  id="edit-subtitle"
                  value={formData().subtitle}
                  onInput={(e) => updateFormField("subtitle", e.currentTarget.value)}
                  placeholder="Optional subtitle"
                />
              </div>
              <div class="form-group">
                <label for="edit-excerpt">Excerpt</label>
                <textarea
                  id="edit-excerpt"
                  value={formData().excerpt}
                  onInput={(e) => updateFormField("excerpt", e.currentTarget.value)}
                  placeholder="A brief excerpt for previews..."
                  rows={2}
                />
              </div>
              <div class="form-group">
                <label for="edit-content">Content *</label>
                <textarea
                  id="edit-content"
                  value={formData().content}
                  onInput={(e) => updateFormField("content", e.currentTarget.value)}
                  placeholder="Write your post content here..."
                  rows={10}
                  required
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="edit-content_format">Content Format</label>
                  <select
                    id="edit-content_format"
                    value={formData().content_format}
                    onChange={(e) =>
                      updateFormField("content_format", e.currentTarget.value as CreatePostData["content_format"])
                    }
                  >
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                    <option value="mdx">MDX</option>
                    <option value="plaintext">Plain Text</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="edit-status">Status</label>
                  <select
                    id="edit-status"
                    value={formData().status}
                    onChange={(e) => updateFormField("status", e.currentTarget.value as CreatePostData["status"])}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="edit-visibility">Visibility</label>
                  <select
                    id="edit-visibility"
                    value={formData().visibility}
                    onChange={(e) =>
                      updateFormField("visibility", e.currentTarget.value as CreatePostData["visibility"])
                    }
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                    <option value="members_only">Members Only</option>
                    <option value="password_protected">Password Protected</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData().featured}
                    onChange={(e) => updateFormField("featured", e.currentTarget.checked)}
                  />
                  Featured Post
                </label>
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
              <h3>Delete Post</h3>
              <button class="btn btn-close" onClick={() => setShowDeleteModal(false)}>
                &times;
              </button>
            </div>
            <div class="modal-body">
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <p>
                Are you sure you want to delete <strong>{deletingPost()?.title}</strong>?
              </p>
              <p class="text-danger">This will permanently delete the post and all associated comments. This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-danger" onClick={handleDelete} disabled={formLoading()}>
                {formLoading() ? "Deleting..." : "Delete Post"}
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
              <th>Title</th>
              <th>Site</th>
              <th>Status</th>
              <th>Visibility</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <Show when={posts().length === 0}>
              <tr>
                <td colspan="6" class="text-center">
                  No posts found. Create your first post to get started.
                </td>
              </tr>
            </Show>
            <For each={posts()}>
              {(post) => (
                <tr>
                  <td>
                    <strong>{post.title}</strong>
                    <Show when={post.subtitle}>
                      <br />
                      <small class="text-muted">{post.subtitle}</small>
                    </Show>
                    <Show when={post.featured}>
                      <span class="badge badge-warning ml-1">Featured</span>
                    </Show>
                  </td>
                  <td>{getSiteName(post.site_id)}</td>
                  <td>
                    <span class={`badge ${getStatusClass(post.status)}`}>{post.status.replace("_", " ")}</span>
                  </td>
                  <td>
                    <span class={`badge ${post.visibility === "public" ? "badge-info" : "badge-secondary"}`}>
                      {post.visibility.replace("_", " ")}
                    </span>
                  </td>
                  <td>{new Date(post.created_at).toLocaleDateString()}</td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-sm" onClick={() => openEditModal(post)}>
                        Edit
                      </button>
                      <button class="btn btn-sm btn-danger" onClick={() => openDeleteModal(post)}>
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

export default Posts;
