import { type Component, createSignal, For, onMount, Show } from "solid-js";
import {
  fetchSites,
  fetchPosts,
  fetchAllPosts,
  fetchComments,
  updateComment,
  deleteComment,
  approveComment,
  rejectComment,
  markCommentAsSpam,
  type Site,
  type Post,
  type Comment,
} from "../lib/api";

const Comments: Component = () => {
  const [comments, setComments] = createSignal<Comment[]>([]);
  const [sites, setSites] = createSignal<Site[]>([]);
  const [posts, setPosts] = createSignal<Post[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Filter states
  const [selectedSiteId, setSelectedSiteId] = createSignal<string>("");
  const [selectedPostId, setSelectedPostId] = createSignal<string>("");
  const [statusFilter, setStatusFilter] = createSignal<string>("");

  // Modal states
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingComment, setEditingComment] = createSignal<Comment | null>(null);
  const [deletingComment, setDeletingComment] = createSignal<Comment | null>(null);

  // Form states
  const [editContent, setEditContent] = createSignal("");
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

  const loadPosts = async () => {
    try {
      const siteId = selectedSiteId();
      let data: Post[];

      if (siteId) {
        data = await fetchPosts(siteId);
      } else {
        data = await fetchAllPosts();
      }

      setPosts(data);
    } catch (err) {
      console.error("Failed to load posts:", err);
    }
  };

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);

      const postId = selectedPostId();
      if (!postId) {
        // Load comments from all posts
        const allPosts = posts();
        const allComments: Comment[] = [];

        for (const post of allPosts) {
          try {
            const postComments = await fetchComments(post.id);
            allComments.push(...postComments.map((c) => ({ ...c, post: { id: post.id, title: post.title, slug: post.slug } })));
          } catch {
            // Post might not have comments endpoint
          }
        }

        setComments(allComments);
      } else {
        const data = await fetchComments(postId);
        const post = posts().find((p) => p.id === postId);
        if (post) {
          setComments(data.map((c) => ({ ...c, post: { id: post.id, title: post.title, slug: post.slug } })));
        } else {
          setComments(data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  onMount(async () => {
    await loadSites();
    await loadPosts();
    await loadComments();
  });

  const filteredComments = () => {
    let filtered = comments();
    const status = statusFilter();

    if (status) {
      filtered = filtered.filter((c) => c.status === status);
    }

    return filtered;
  };

  const openEditModal = (comment: Comment) => {
    setEditingComment(comment);
    setEditContent(comment.content);
    setFormError(null);
    setShowEditModal(true);
  };

  const openDeleteModal = (comment: Comment) => {
    setDeletingComment(comment);
    setShowDeleteModal(true);
  };

  const handleUpdate = async (e: Event) => {
    e.preventDefault();
    const comment = editingComment();
    if (!comment) return;

    setFormLoading(true);
    setFormError(null);

    try {
      await updateComment(comment.id, { content: editContent() });
      setShowEditModal(false);
      setEditingComment(null);
      await loadComments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update comment");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    const comment = deletingComment();
    if (!comment) return;

    setFormLoading(true);
    setFormError(null);

    try {
      await deleteComment(comment.id);
      setShowDeleteModal(false);
      setDeletingComment(null);
      await loadComments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setFormLoading(false);
    }
  };

  const handleApprove = async (comment: Comment) => {
    try {
      await approveComment(comment.id);
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve comment");
    }
  };

  const handleReject = async (comment: Comment) => {
    try {
      await rejectComment(comment.id);
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject comment");
    }
  };

  const handleMarkSpam = async (comment: Comment) => {
    try {
      await markCommentAsSpam(comment.id);
      await loadComments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark comment as spam");
    }
  };

  const handleSiteFilterChange = async (siteId: string) => {
    setSelectedSiteId(siteId);
    setSelectedPostId("");
    await loadPosts();
    await loadComments();
  };

  const handlePostFilterChange = async (postId: string) => {
    setSelectedPostId(postId);
    await loadComments();
  };

  const getStatusClass = (status: Comment["status"]) => {
    switch (status) {
      case "approved":
        return "badge-success";
      case "pending":
        return "badge-warning";
      case "spam":
        return "badge-danger";
      case "rejected":
        return "badge-inactive";
      case "flagged":
        return "badge-danger";
      case "deleted":
        return "badge-inactive";
      default:
        return "badge-secondary";
    }
  };

  const getAuthorName = (comment: Comment) => {
    if (comment.author) {
      return comment.author.display_name || comment.author.username || "Unknown";
    }
    return comment.anonymous_name || "Anonymous";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  const pendingCount = () => comments().filter((c) => c.status === "pending").length;
  const flaggedCount = () => comments().filter((c) => c.status === "flagged").length;
  const spamCount = () => comments().filter((c) => c.status === "spam").length;

  return (
    <div class="page comments">
      <div class="page-header">
        <h2>Comments</h2>
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
          <select
            class="form-select"
            value={selectedPostId()}
            onChange={(e) => handlePostFilterChange(e.currentTarget.value)}
          >
            <option value="">All Posts</option>
            <For each={posts()}>
              {(post) => <option value={post.id}>{post.title}</option>}
            </For>
          </select>
          <select
            class="form-select"
            value={statusFilter()}
            onChange={(e) => setStatusFilter(e.currentTarget.value)}
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="spam">Spam</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">Total</span>
          <span class="stat-value">{comments().length}</span>
        </div>
        <div class="stat-item stat-warning">
          <span class="stat-label">Pending</span>
          <span class="stat-value">{pendingCount()}</span>
        </div>
        <div class="stat-item stat-danger">
          <span class="stat-label">Flagged</span>
          <span class="stat-value">{flaggedCount()}</span>
        </div>
        <div class="stat-item stat-danger">
          <span class="stat-label">Spam</span>
          <span class="stat-value">{spamCount()}</span>
        </div>
      </div>

      <Show when={error()}>
        <div class="alert alert-danger">{error()}</div>
      </Show>

      {/* Edit Modal */}
      <Show when={showEditModal()}>
        <div class="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div class="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Edit Comment</h3>
              <button class="btn btn-close" onClick={() => setShowEditModal(false)}>
                &times;
              </button>
            </div>
            <form class="modal-body" onSubmit={handleUpdate}>
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <div class="form-group">
                <label>Author</label>
                <p class="form-text">{getAuthorName(editingComment()!)}</p>
              </div>
              <div class="form-group">
                <label for="content">Content</label>
                <textarea
                  id="content"
                  value={editContent()}
                  onInput={(e) => setEditContent(e.currentTarget.value)}
                  rows={6}
                  required
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

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteModal()}>
        <div class="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Delete Comment</h3>
              <button class="btn btn-close" onClick={() => setShowDeleteModal(false)}>
                &times;
              </button>
            </div>
            <div class="modal-body">
              <Show when={formError()}>
                <div class="alert alert-danger">{formError()}</div>
              </Show>
              <p>Are you sure you want to delete this comment?</p>
              <div class="comment-preview">
                <p>
                  <strong>By:</strong> {getAuthorName(deletingComment()!)}
                </p>
                <p>
                  <strong>Content:</strong> {truncateContent(deletingComment()?.content || "", 200)}
                </p>
              </div>
              <p class="text-danger">This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={formLoading()}>
                Cancel
              </button>
              <button class="btn btn-danger" onClick={handleDelete} disabled={formLoading()}>
                {formLoading() ? "Deleting..." : "Delete Comment"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      {loading() ? (
        <div class="loading-spinner">Loading...</div>
      ) : (
        <div class="comments-list">
          <Show when={filteredComments().length === 0}>
            <div class="empty-state">
              <p>No comments found.</p>
            </div>
          </Show>
          <For each={filteredComments()}>
            {(comment) => (
              <div class={`comment-card ${comment.status === "pending" ? "comment-pending" : ""}`}>
                <div class="comment-header">
                  <div class="comment-author">
                    <strong>{getAuthorName(comment)}</strong>
                    <Show when={comment.author}>
                      <span class="badge badge-info ml-1">Registered</span>
                    </Show>
                  </div>
                  <span class={`badge ${getStatusClass(comment.status)}`}>{comment.status}</span>
                </div>
                <div class="comment-meta">
                  <span>On: {comment.post?.title || "Unknown Post"}</span>
                  <span class="separator">|</span>
                  <span>{formatDate(comment.created_at)}</span>
                  <Show when={comment.is_edited}>
                    <span class="separator">|</span>
                    <span class="text-muted">(edited)</span>
                  </Show>
                </div>
                <div class="comment-content">
                  <p>{comment.content}</p>
                </div>
                <Show when={comment.reply_count > 0}>
                  <div class="comment-replies">
                    <span class="text-muted">{comment.reply_count} replies</span>
                  </div>
                </Show>
                <div class="comment-actions">
                  <Show when={comment.status === "pending"}>
                    <button class="btn btn-sm btn-success" onClick={() => handleApprove(comment)}>
                      Approve
                    </button>
                    <button class="btn btn-sm btn-danger" onClick={() => handleReject(comment)}>
                      Reject
                    </button>
                  </Show>
                  <Show when={comment.status !== "spam"}>
                    <button class="btn btn-sm btn-warning" onClick={() => handleMarkSpam(comment)}>
                      Spam
                    </button>
                  </Show>
                  <button class="btn btn-sm" onClick={() => openEditModal(comment)}>
                    Edit
                  </button>
                  <button class="btn btn-sm btn-danger" onClick={() => openDeleteModal(comment)}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      )}
    </div>
  );
};

export default Comments;
