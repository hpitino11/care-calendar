import './TopNav.css';

function TopNav() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <header className="topnav">
      <div className="topnav-brand">
        <span className="topnav-logo-text">Care</span>
        <span className="topnav-heart">♥</span>
        <span className="topnav-logo-text">Calendar</span>
      </div>

      <div className="topnav-right">
        <span className="topnav-date">{today}</span>

        <button className="topnav-icon-btn" title="Notifications" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="topnav-badge" />
        </button>

        <div className="topnav-avatar" title="Coordinator">HC</div>
      </div>
    </header>
  );
}

export default TopNav;
