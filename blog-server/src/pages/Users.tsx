import { type Component, createSignal, For, onMount } from "solid-js";

interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  isVerified: boolean;
  createdAt: string;
}

const Users: Component = () => {
  const [users, setUsers] = createSignal<User[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    // TODO: Fetch actual users from API
    setUsers([
      {
        id: "1",
        username: "admin",
        displayName: "Administrator",
        email: "admin@example.com",
        isAdmin: true,
        isVerified: true,
        createdAt: "2024-01-01",
      },
      {
        id: "2",
        username: "john_doe",
        displayName: "John Doe",
        email: "john@example.com",
        isAdmin: false,
        isVerified: true,
        createdAt: "2024-02-15",
      },
    ]);
    setLoading(false);
  });

  return (
    <div class="page users">
      <div class="page-header">
        <h2>Users</h2>
        <button class="btn btn-primary">New User</button>
      </div>

      {loading() ? (
        <p>Loading...</p>
      ) : (
        <table class="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Display Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <For each={users()}>
              {(user) => (
                <tr>
                  <td>{user.username}</td>
                  <td>{user.displayName}</td>
                  <td>{user.email}</td>
                  <td>
                    <span
                      class={`badge ${user.isAdmin ? "badge-primary" : "badge-secondary"}`}
                    >
                      {user.isAdmin ? "Admin" : "User"}
                    </span>
                  </td>
                  <td>
                    <span
                      class={`badge ${user.isVerified ? "badge-success" : "badge-warning"}`}
                    >
                      {user.isVerified ? "Yes" : "No"}
                    </span>
                  </td>
                  <td>{user.createdAt}</td>
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

export default Users;
