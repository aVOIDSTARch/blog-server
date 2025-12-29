import { type Component, createSignal, For, onMount } from "solid-js";

interface Post {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  author: string;
  siteName: string;
  createdAt: string;
}

const Posts: Component = () => {
  const [posts, setPosts] = createSignal<Post[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    // TODO: Fetch actual posts from API
    setPosts([
      {
        id: "1",
        title: "Getting Started with SolidJS",
        slug: "getting-started-solidjs",
        status: "published",
        author: "Admin",
        siteName: "Tech Blog",
        createdAt: "2024-03-01",
      },
      {
        id: "2",
        title: "Building APIs with Prisma",
        slug: "building-apis-prisma",
        status: "draft",
        author: "Admin",
        siteName: "Tech Blog",
        createdAt: "2024-03-15",
      },
    ]);
    setLoading(false);
  });

  const getStatusClass = (status: Post["status"]) => {
    switch (status) {
      case "published":
        return "badge-success";
      case "draft":
        return "badge-warning";
      case "archived":
        return "badge-inactive";
    }
  };

  return (
    <div class="page posts">
      <div class="page-header">
        <h2>Posts</h2>
        <button class="btn btn-primary">New Post</button>
      </div>

      {loading() ? (
        <p>Loading...</p>
      ) : (
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Site</th>
              <th>Author</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={posts()}>
              {(post) => (
                <tr>
                  <td>{post.title}</td>
                  <td>{post.siteName}</td>
                  <td>{post.author}</td>
                  <td>
                    <span class={`badge ${getStatusClass(post.status)}`}>
                      {post.status}
                    </span>
                  </td>
                  <td>{post.createdAt}</td>
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

export default Posts;
