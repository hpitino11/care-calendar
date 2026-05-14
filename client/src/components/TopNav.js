import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BASE_URL from '../api';
import './TopNav.css';

function TopNav() {
  const [query, setQuery] = useState('');
  const [allData, setAllData] = useState({ visits: [], caregivers: [], clients: [] });
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  // Load all data once so search works client-side without per-keystroke requests
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [visitsRes, caregiversRes, clientsRes] = await Promise.all([
          fetch(`${BASE_URL}/api/visits`),
          fetch(`${BASE_URL}/api/caregivers`),
          fetch(`${BASE_URL}/api/clients`),
        ]);
        setAllData({
          visits: await visitsRes.json(),
          caregivers: await caregiversRes.json(),
          clients: await clientsRes.json(),
        });
      } catch (err) {
        console.error('Search data failed to load', err);
      }
    };
    fetchAll();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const q = query.toLowerCase().trim();

  const matchedVisits = q
    ? allData.visits
        .filter((v) => v.caregiver_name?.toLowerCase().includes(q) || v.client_name?.toLowerCase().includes(q))
        .slice(0, 4)
    : [];
  const matchedCaregivers = q
    ? allData.caregivers.filter((c) => c.name?.toLowerCase().includes(q)).slice(0, 4)
    : [];
  const matchedClients = q
    ? allData.clients.filter((c) => c.name?.toLowerCase().includes(q)).slice(0, 4)
    : [];

  const hasResults = matchedVisits.length || matchedCaregivers.length || matchedClients.length;

  const handleSelect = (path) => {
    navigate(path);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <header className="topnav">
      <div className="topnav-search" ref={searchRef}>
        <div className="topnav-search-box">
          <svg className="topnav-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="topnav-search-input"
            type="text"
            placeholder="Search visits, caregivers, clients..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && q && (
            <div className="topnav-search-dropdown">
              {hasResults ? (
                <>
                  {matchedVisits.length > 0 && (
                    <div className="search-group">
                      <p className="search-group-label">Visits</p>
                      {matchedVisits.map((v) => (
                        <button key={v.id} className="search-result" onClick={() => handleSelect('/visits')}>
                          <span className="search-result-name">{v.caregiver_name}</span>
                          <span className="search-result-sub">{v.client_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedCaregivers.length > 0 && (
                    <div className="search-group">
                      <p className="search-group-label">Caregivers</p>
                      {matchedCaregivers.map((c) => (
                        <button key={c.id} className="search-result" onClick={() => handleSelect('/caregivers')}>
                          <span className="search-result-name">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedClients.length > 0 && (
                    <div className="search-group">
                      <p className="search-group-label">Clients</p>
                      {matchedClients.map((c) => (
                        <button key={c.id} className="search-result" onClick={() => handleSelect('/clients')}>
                          <span className="search-result-name">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="search-empty">No results for "{query}"</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="topnav-right">
        <span className="topnav-date">{today}</span>

        <button className="topnav-icon-btn" aria-label="Notifications">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>

        <div className="topnav-user">
          <div className="topnav-avatar">A</div>
        </div>
      </div>
    </header>
  );
}

export default TopNav;
