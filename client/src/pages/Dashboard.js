import { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import AddVisitModal from './AddVisitModal';
import VisitDetailModal from './VisitDetailModal';
import BASE_URL from '../api';
import './Dashboard.css';

const STATUS_COLORS = {
  scheduled:   '#2d3f8e',
  in_progress: '#c17a5a',
  completed:   '#6b7280',
};

const formatEventTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

function Dashboard() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefillDate, setPrefillDate] = useState('');
  const [selectedVisit, setSelectedVisit] = useState(null);

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

  const today = new Date().toISOString().split('T')[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning, Admin 👋' : hour < 17 ? 'Good afternoon, Admin 👋' : 'Good evening, Admin 👋';
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const dateShort = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Cancelled visits today — strip time portion in case Postgres returns a timestamp
  const cancelledToday = visits.filter((v) => {
    const visitDate = v.visit_date ? v.visit_date.split('T')[0] : v.visit_date;
    return v.status === 'cancelled' && visitDate === today;
  });

  // Cancelled visits are excluded from the calendar grid
  const calendarEvents = visits
    .filter((v) => v.status !== 'cancelled')
    .map((v) => {
      const startDate = v.visit_date ? v.visit_date.split('T')[0] : v.visit_date;
      const endDate = v.end_date ? v.end_date.split('T')[0] : startDate;
      const isMultiDay = endDate && endDate !== startDate;

      // FullCalendar end is exclusive — add one day for multi-day events
      let calendarEnd;
      if (isMultiDay) {
        const endDateObj = new Date(endDate + 'T00:00:00');
        endDateObj.setDate(endDateObj.getDate() + 1);
        calendarEnd = endDateObj.toISOString().split('T')[0];
      } else {
        calendarEnd = `${startDate}T${v.end_time}`;
      }

      return {
        id: String(v.id),
        title: v.caregiver_name,
        start: isMultiDay ? startDate : `${startDate}T${v.start_time}`,
        end: calendarEnd,
        allDay: Boolean(isMultiDay),
        backgroundColor: STATUS_COLORS[v.status] || STATUS_COLORS.scheduled,
        borderColor: 'transparent',
        extendedProps: {
          caregiverName: v.caregiver_name,
          clientName: v.client_name,
          serviceType: v.service_type,
          isMultiDay: Boolean(isMultiDay),
          endDate: v.end_date,
          visit: v,
        },
      };
    });

  // Clicking an empty date slot pre-fills the date in the add modal
  const handleDateClick = (info) => {
    setPrefillDate(info.dateStr.slice(0, 10));
    setShowAddModal(true);
  };

  // Clicking an existing event opens the detail modal
  const handleEventClick = (info) => {
    setSelectedVisit(info.event.extendedProps.visit);
  };

  // ── Stats ──
  const todayVisits = visits.filter((v) => {
    const vDate = v.visit_date ? v.visit_date.split('T')[0] : null;
    return vDate === today;
  }).length;

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekScheduled = visits.filter((v) => {
    const d = new Date(v.visit_date);
    return v.status === 'scheduled' && d >= monday && d <= sunday;
  }).length;

  const activeCaregivers = new Set(
    visits.filter((v) => v.status !== 'cancelled').map((v) => v.caregiver_id)
  ).size;

  // Previous week for trend badges
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);

  const prevWeekScheduled = visits.filter((v) => {
    const d = new Date(v.visit_date + 'T00:00:00');
    return v.status === 'scheduled' && d >= prevMonday && d <= prevSunday;
  }).length;

  const prevActiveCaregivers = new Set(
    visits.filter((v) => {
      const d = new Date(v.visit_date + 'T00:00:00');
      return v.status !== 'cancelled' && d >= prevMonday && d <= prevSunday;
    }).map((v) => v.caregiver_id)
  ).size;

  function pctChange(current, previous) {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  const weekPct = pctChange(weekScheduled, prevWeekScheduled);
  const caregiverPct = pctChange(activeCaregivers, prevActiveCaregivers);

  if (loading) return <p className="state-loading">Loading...</p>;
  if (error)   return <p className="state-error">Something went wrong.</p>;

  return (
    <div>
      {/* Page header */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-greeting">{greeting}</h1>
          <p className="dash-date">{dateLabel}</p>
        </div>
        <button className="btn-new-visit" onClick={() => setShowAddModal(true)}>
          + New Visit
        </button>
      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="stat-body">
            <p className="stat-number">{todayVisits}</p>
            <p className="stat-label">Visits Today</p>
            <p className="stat-sub">Scheduled for {dateShort}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="stat-body">
            <p className="stat-number">{weekScheduled}</p>
            <p className="stat-label">This Week</p>
            <p className="stat-sub">Scheduled visits</p>
            {weekPct !== null && (
              <span className={`stat-change ${weekPct >= 0 ? 'stat-change--pos' : 'stat-change--neg'}`}>
                {weekPct > 0 ? '+' : ''}{weekPct}% vs last week
              </span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="stat-body">
            <p className="stat-number">{activeCaregivers}</p>
            <p className="stat-label">Active Caregivers</p>
            <p className="stat-sub">With scheduled visits</p>
            {caregiverPct !== null && (
              <span className={`stat-change ${caregiverPct >= 0 ? 'stat-change--pos' : 'stat-change--neg'}`}>
                {caregiverPct > 0 ? '+' : ''}{caregiverPct}% vs last week
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cancelled bar — only renders when there are cancelled visits today */}
      {cancelledToday.length > 0 && (
        <div className="cancelled-bar">
          <p className="cancelled-bar-title">Cancelled Today</p>
          {cancelledToday.map((v) => (
            <p key={v.id} className="cancelled-bar-item">
              <s>{v.caregiver_name} — {formatTime(v.start_time)} – {formatTime(v.end_time)}</s>
            </p>
          ))}
        </div>
      )}

      {/* Calendar */}
      <div className="calendar-wrapper">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev next',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={calendarEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventMaxStack={3}
          slotEventOverlap={false}
          eventMinHeight={40}
          eventContent={(arg) => {
            const isMonthView = arg.view.type === 'dayGridMonth';

            // All-day row (multi-day visits in week/day view)
            if (arg.event.allDay) {
              return (
                <div style={{ padding: '2px 6px', overflow: 'hidden' }}>
                  <div style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 700,
                    fontSize: '11px',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {arg.event.extendedProps.caregiverName}
                  </div>
                  <div style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 400,
                    fontSize: '10px',
                    color: 'rgba(255,255,255,0.75)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {arg.event.extendedProps.clientName}
                  </div>
                  {arg.event.extendedProps.serviceType && (
                    <div style={{
                      fontFamily: 'Spartan, sans-serif',
                      fontWeight: 700,
                      fontSize: '9px',
                      color: 'rgba(255,255,255,0.6)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginTop: '1px',
                    }}>
                      {arg.event.extendedProps.serviceType}
                    </div>
                  )}
                </div>
              );
            }

            // Month view — compact single-line dot chip
            if (isMonthView) {
              return (
                <div style={{ padding: '2px 4px', overflow: 'hidden' }}>
                  <div style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 700,
                    fontSize: '11px',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {arg.event.extendedProps.caregiverName}
                  </div>
                </div>
              );
            }

            // Week / Day view — full info block
            return (
              <div style={{
                padding: '6px 8px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                gap: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  fontFamily: 'Spartan, sans-serif',
                  fontWeight: 400,
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.7)',
                  letterSpacing: '0.02em',
                }}>
                  {formatEventTime(arg.event.start)} - {formatEventTime(arg.event.end)}
                </div>
                <div style={{
                  fontFamily: 'Spartan, sans-serif',
                  fontWeight: 700,
                  fontSize: '12px',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {arg.event.extendedProps.caregiverName}
                </div>
                <div style={{
                  fontFamily: 'Spartan, sans-serif',
                  fontWeight: 400,
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.8)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {arg.event.extendedProps.clientName}
                </div>
                {arg.event.extendedProps.serviceType && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '4px',
                  }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>♥</span>
                    <span style={{
                      fontFamily: 'Spartan, sans-serif',
                      fontWeight: 700,
                      fontSize: '9px',
                      color: 'rgba(255,255,255,0.7)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}>
                      {arg.event.extendedProps.serviceType}
                    </span>
                  </div>
                )}
              </div>
            );
          }}
          height="auto"
        />
      </div>

      {showAddModal && (
        <AddVisitModal
          onClose={() => { setShowAddModal(false); setPrefillDate(''); }}
          onSuccess={fetchVisits}
          prefillDate={prefillDate}
        />
      )}

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

export default Dashboard;
