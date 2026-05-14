import TopNav from './TopNav';
import Sidebar from './Sidebar';
import './Layout.css';

function Layout({ children }) {
  return (
    <div>
      <TopNav />
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
