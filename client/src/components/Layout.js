import TopNav from './TopNav';
import Sidebar from './Sidebar';
import './Layout.css';

function Layout({ children }) {
  return (
    <div className="app-shell">
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <div className="blob blob-d" />
      <div className="blob blob-e" />
      <div className="blob blob-f" />
      <div className="blob blob-g" />
      <Sidebar />
      <div className="right-pane">
        <TopNav />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
