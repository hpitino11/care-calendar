import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const navItems = [
  { to: '/',           label: 'Dashboard'  },
  { to: '/visits',     label: 'Visits'     },
  { to: '/caregivers', label: 'Caregivers' },
  { to: '/clients',    label: 'Clients'    },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              isActive ? 'sidebar-link sidebar-link--active' : 'sidebar-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">© Care Calendar</div>
    </aside>
  );
}

export default Sidebar;
