import { useState, useEffect } from 'react';
import AddVisitModal from './AddVisitModal';
import VisitDetailModal from './VisitDetailModal';
import BASE_URL from '../api';
import './Visits.css';

// Status options available for filtering — "All" shows every visit regardless of status
const STATUS_FILTERS = ['All', 'scheduled', 'completed', 'cancelled'];

// Returns the day number and abbreviated month string for a given date.
// The T00:00:00 suffix prevents timezone offset issues when parsing date-only strings.
function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    day: d.getDate(),
    month: d.toLocaleString('default', { month: 'short' }).toUpperCase(),
  };
}

// Converts a raw HH:MM time string from the database to 12-hour format
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

// Renders a colored status pill based on the visit's current status
function StatusBadge({ status }) {
  return <span className={`status-badge status-badge--${status}`}>{status}</span>;
}

function Visits() {
  // ── State ──
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null); // opens VisitDetailModal when set

  // ── Data fetching ──
  const fetchVisits = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/visits`);
      const data = await res.json();
      setVisits(data);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  // ── Filtering ──
  // Apply search and status filter together before grouping by date
  const filtered = visits.filter((v) => {
    const matchesSearch =
      v.caregiver_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.client_name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'All' || v.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  // Group visits by date for the agenda-style layout
  // Each key is a date string (YYYY-MM-DD) and the value is an array of visits on that date
  const grouped = filtered.reduce((acc, visit) => {
    const date = visit.visit_date ? visit.visit_date.split('T')[0] : visit.visit_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(visit);
    return acc;
  }, {});

  if (loading) return <p className="state-loading">Loading...</p>;
  if (error)   return <p className="state-error">Something went wrong.</p>;

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Visits</h1>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          Schedule Visit
        </button>
      </div>

      {/* Search bar */}
      <input
        className="visits-search"
        type="text"
        placeholder="Search by caregiver or client name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Status filter buttons */}
      <div className="filter-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-btn ${activeFilter === f ? 'filter-btn--active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Visits list — grouped by date, sorted chronologically */}
      {filtered.length === 0 ? (
        <p className="state-empty">No visits scheduled yet.</p>
      ) : (
        <div className="visits-list">
          {Object.keys(grouped).sort().map((date) => (
            <div key={date} className="visits-group">
              {grouped[date].map((visit) => {
                const startDate = visit.visit_date ? visit.visit_date.split('T')[0] : visit.visit_date;
                const endDate = visit.end_date ? visit.end_date.split('T')[0] : null;
                const isMultiDay = endDate && endDate !== startDate;
                const start = formatShortDate(startDate);
                const end = isMultiDay ? formatShortDate(endDate) : null;

                return (
                  // Clicking any visit row opens the detail modal
                  <div
                    key={visit.id}
                    className={`visit-row${visit.status === 'cancelled' ? ' visit-row--cancelled' : ''}`}
                    onClick={() => setSelectedVisit(visit)}
                  >
                    {/* Date block — shows a range for multi-day visits */}
                    <div className="visit-date-block">
                      {isMultiDay ? (
                        <>
                          <div className="visit-day" style={{ fontSize: '14px' }}>
                            {start.month} {start.day}
                          </div>
                          <div className="visit-date-arrow">→</div>
                          <div className="visit-day" style={{ fontSize: '14px' }}>
                            {end.month} {end.day}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="visit-day">{start.day}</div>
                          <div className="visit-month">{start.month}</div>
                        </>
                      )}
                    </div>

                    {/* Visit details — caregiver, client, service tag, and time range */}
                    <div className="visit-info">
                      <p className="visit-caregiver">{visit.caregiver_name}</p>
                      <p className="visit-client">{visit.client_name}</p>
                      {visit.service_type && (
                        <div className="visit-service-tag">{visit.service_type}</div>
                      )}
                      <p className="visit-time">
                        {formatTime(visit.start_time)} – {formatTime(visit.end_time)}
                      </p>
                    </div>

                    {/* Status badge */}
                    <div className="visit-actions">
                      <StatusBadge status={visit.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Schedule Visit modal */}
      {showAddModal && (
        <AddVisitModal
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchVisits}
        />
      )}

      {/* Visit Detail modal */}
      {selectedVisit && (
        <VisitDetailModal
          visit={selectedVisit}
          onClose={() => setSelectedVisit(null)}
          onSuccess={fetchVisits}
        />
      )}
    </div>
  );
}

export default Visits;
