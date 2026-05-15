import { useState } from 'react';
import TopNav from './TopNav';
import Sidebar from './Sidebar';
import './Layout.css';

function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <div className="blob blob-d" />
      <div className="blob blob-e" />
      <div className="blob blob-f" />
      <div className="blob blob-g" />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar onClose={() => setSidebarOpen(false)} />
      <div className="right-pane">
        <TopNav onMenuClick={() => setSidebarOpen((o) => !o)} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default Layout;
