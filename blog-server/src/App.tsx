import { type Component } from "solid-js";
import { Router, Route, A } from "@solidjs/router";
import Dashboard from "./pages/Dashboard";
import Sites from "./pages/Sites";
import Users from "./pages/Users";
import ApiKeys from "./pages/ApiKeys";
import Posts from "./pages/Posts";

const Layout: Component<{ children?: any }> = (props) => {
  return (
    <div class="app-layout">
      <nav class="sidebar">
        <div class="sidebar-header">
          <h1>Blog Admin</h1>
        </div>
        <ul class="nav-links">
          <li>
            <A href="/" end>
              Dashboard
            </A>
          </li>
          <li>
            <A href="/sites">Sites</A>
          </li>
          <li>
            <A href="/posts">Posts</A>
          </li>
          <li>
            <A href="/users">Users</A>
          </li>
          <li>
            <A href="/api-keys">API Keys</A>
          </li>
        </ul>
      </nav>
      <main class="main-content">{props.children}</main>
    </div>
  );
};

const App: Component = () => {
  return (
    <Router root={Layout}>
      <Route path="/" component={Dashboard} />
      <Route path="/sites" component={Sites} />
      <Route path="/posts" component={Posts} />
      <Route path="/users" component={Users} />
      <Route path="/api-keys" component={ApiKeys} />
    </Router>
  );
};

export default App;
