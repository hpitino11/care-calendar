import TopNav from './TopNav';
import Sidebar from './Sidebar';
import './Layout.css';

function Layout({ children }) {
  return (
    <div>
      <div className="blob blob-a" />
      <div className="blob blob-b" />
      <div className="blob blob-c" />
      <div className="blob blob-d" />
      <div className="blob blob-e" />
      <div className="blob blob-f" />
      <div className="blob blob-g" />
      <TopNav />
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
