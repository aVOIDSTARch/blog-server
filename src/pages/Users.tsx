import { type Component, createSignal, For, onMount, Show } from "solid-js";
import {
  fetchUsers,
  updateUser,
  deleteUser,
  type User,
  type UpdateUserData,
} from "../lib/api";

const Users: Component = () => {
  const [users, setUsers] = createSignal<User[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Modal states
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingUser, setEditingUser] = createSignal<User | null>(null);
  const [deletingUser, setDeletingUser] = createSignal<User | null>(null);

  // Form states
  const [formData, setFormData] = createSignal<UpdateUserData>({
    display_name: "",
    username: "",
    bio: "",
    website: "",
    is_admin: false,
    is_moderator: false,
    is_verified: false,
  });
  const [formError, setFormError] = createSignal<string | null>(null);
  const [formLoading, setFormLoading] = createSignal(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    loadUsers();
  });

  const resetForm = () => {
    setFormData({
      display_name: "",
      username: "",
      bio: "",
      website: "",
      is_admin: false,
      is_moderator: false,
      is_verified: false,
    });
    setFormError(null);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      display_name: user.display_name,
      username: user.username || "",
      bio: user.bio || "",
      website: user.website || "",
      is_admin: user.is_admin,
      is_moderator: user.is_moderator,
      is_verified: user.is_verified,
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (user: User) => {
    setDeletingUser(user);
    setShowDeleteModal(true);
  };

  const handleUpdate = async (e: Event) => {
    e.preventDefault();
    const user = editingUser();
    if (!user) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const data = formData();
      const updateData: UpdateUserData = {};

      // Only include changed fields
      if (data.display_name !== user.display_name) updateData.display_name = data.display_name;
      if ((data.username || null) !== user.username) updateData.username = data.username || undefined;
      if ((data.bio || null) !== user.bio) updateData.bio = data.bio || undefined;
      if ((data.website || null) !== user.website) updateData.website = data.website || undefined;
      if (data.is_admin !== user.is_admin) updateData.is_admin = data.is_admin;
      if (data.is_moderator !== user.is_moderator) updateData.is_moderator = data.is_moderator;
      if (data.is_verified !== user.is_verified) updateData.is_verified = data.is_verified;

      await updateUser(user.id, updateData);
      setShowEditModal(false);
      setEditingUser(null);
      resetForm();
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    const user = deletingUser();
    if (!user) return;

    setFormLoading(true);
    setFormError(null);

    try {
      await deleteUser(user.id);
      setShowDeleteModal(false);
      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setFormLoading(false);
    }
  };

  const updateFormField = <K extends keyof UpdateUserData>(field: K, value: UpdateUserData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const getRoleBadges = (user: User) => {
    const badges: { label: string; class: string }[] = [];

    if (user.is_admin) {
      badges.push({ label: "Admin", class: "badge-danger" });
    }
    if (user.is_moderator) {
      badges.push({ label: "Moderator", class: "badge-warning" });
    }
    if (!user.is_admin && !user.is_moderator) {
      badges.push({ label: "User", class: "badge-secondary" });
    }

    return badges;
  };

  return (
    <div class="page users">
      <div class="page-header">
        <h2>Users</h2>
      </div>

      <Show when={error()}>
        <div class="alert alert-danger">{error()}</div>
      </Show>

      {/* Edit Modal */}
      <Show when={showEditModal()}>
        <div class="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div class="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Edit User</h3>
              <button class="btn btn-close" onClick={() => setShowEditModal(false)}>
                &times;
              </button>
            </div>
            <form class="modal-body" onSubmit={handleUpdate}>
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <div class="form-group">
                <label>Email</label>
                <p class="form-text">{editingUser()?.email}</p>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="display_name">Display Name *</label>
                  <input
                    type="text"
                    id="display_name"
                    value={formData().display_name}
                    onInput={(e) => updateFormField("display_name", e.currentTarget.value)}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div class="form-group">
                  <label for="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    value={formData().username}
                    onInput={(e) => updateFormField("username", e.currentTarget.value)}
                    placeholder="johndoe"
                  />
                </div>
              </div>
              <div class="form-group">
                <label for="bio">Bio</label>
                <textarea
                  id="bio"
                  value={formData().bio}
                  onInput={(e) => updateFormField("bio", e.currentTarget.value)}
                  placeholder="A short bio..."
                  rows={3}
                />
              </div>
              <div class="form-group">
                <label for="website">Website</label>
                <input
                  type="url"
                  id="website"
                  value={formData().website}
                  onInput={(e) => updateFormField("website", e.currentTarget.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div class="form-group">
                <label>Roles & Permissions</label>
                <div class="checkbox-group-vertical">
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().is_admin}
                      onChange={(e) => updateFormField("is_admin", e.currentTarget.checked)}
                    />
                    Administrator
                    <small class="text-muted">Full access to all resources</small>
                  </label>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().is_moderator}
                      onChange={(e) => updateFormField("is_moderator", e.currentTarget.checked)}
                    />
                    Moderator
                    <small class="text-muted">Can moderate comments and content</small>
                  </label>
                  <label class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData().is_verified}
                      onChange={(e) => updateFormField("is_verified", e.currentTarget.checked)}
                    />
                    Verified
                    <small class="text-muted">Verified user badge</small>
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
              <h3>Delete User</h3>
              <button class="btn btn-close" onClick={() => setShowDeleteModal(false)}>
                &times;
              </button>
            </div>
            <div class="modal-body">
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <p>
                Are you sure you want to delete <strong>{deletingUser()?.display_name}</strong> ({deletingUser()?.email})?
              </p>
              <p class="text-danger">
                This will permanently delete the user and all their associated content (posts, comments).
                This action cannot be undone.
              </p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-danger" onClick={handleDelete} disabled={formLoading()}>
                {formLoading() ? "Deleting..." : "Delete User"}
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
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Reputation</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <Show when={users().length === 0}>
              <tr>
                <td colspan="7" class="text-center">
                  No users found.
                </td>
              </tr>
            </Show>
            <For each={users()}>
              {(user) => (
                <tr>
                  <td>
                    <div class="user-info">
                      <Show when={user.avatar_url}>
                        <img src={user.avatar_url!} alt={user.display_name} class="avatar" />
                      </Show>
                      <Show when={!user.avatar_url}>
                        <div class="avatar avatar-placeholder">
                          {user.display_name.charAt(0).toUpperCase()}
                        </div>
                      </Show>
                      <div>
                        <strong>{user.display_name}</strong>
                        <Show when={user.username}>
                          <br />
                          <small class="text-muted">@{user.username}</small>
                        </Show>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <For each={getRoleBadges(user)}>
                      {(badge) => <span class={`badge ${badge.class} mr-1`}>{badge.label}</span>}
                    </For>
                  </td>
                  <td>
                    <span class={`badge ${user.is_verified ? "badge-success" : "badge-inactive"}`}>
                      {user.is_verified ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>{user.reputation}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn-sm" onClick={() => openEditModal(user)}>
                        Edit
                      </button>
                      <button class="btn btn-sm btn-danger" onClick={() => openDeleteModal(user)}>
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

export default Users;
