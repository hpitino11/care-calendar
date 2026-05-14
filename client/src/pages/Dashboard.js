import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import AddVisitModal from './AddVisitModal';
import VisitDetailModal from './VisitDetailModal';
import BASE_URL from '../api';
import './Dashboard.css';

// All visit statuses use the same navy color on the calendar for visual consistency
const STATUS_COLORS = {
  scheduled:   '#2d3f8e',
  in_progress: '#2d3f8e',
  completed:   '#2d3f8e',
};

// Formats a JS Date object to a readable 12-hour time string (used in week/day event cards)
const formatEventTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

// Formats a raw HH:MM time string from the database into 12-hour format
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

// Calculates and formats the duration between two HH:MM time strings
function formatDuration(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const totalMins = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMins <= 0) return '';
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Groups overlapping or close (≤30 min gap) timed events per day for the week view.
// Single events pass through unchanged. Groups of 2+ are merged into one meta-event
// that stores the original visits in extendedProps so the tooltip can list them.
function groupWeekViewEvents(events) {
  const CLOSE_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
  const byDay = {};
  const result = [];

  // Separate all-day events (multi-day visits) from timed events, then bucket by date
  events.forEach((event) => {
    if (event.allDay) { result.push(event); return; }
    const day = event.start.split('T')[0];
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(event);
  });

  // For each day, sort events by start time and greedily merge overlapping/close ones
  Object.values(byDay).forEach((dayEvents) => {
    const sorted = [...dayEvents].sort((a, b) => new Date(a.start) - new Date(b.start));
    const groups = [];
    let group = [sorted[0]];
    let maxEnd = new Date(sorted[0].end);

    for (let i = 1; i < sorted.length; i++) {
      const start = new Date(sorted[i].start);
      const end = new Date(sorted[i].end);
      // Include in the current group if it starts within 30 min of the group's furthest end
      if (start <= new Date(maxEnd.getTime() + CLOSE_MS)) {
        group.push(sorted[i]);
        if (end > maxEnd) maxEnd = end;
      } else {
        groups.push(group);
        group = [sorted[i]];
        maxEnd = end;
      }
    }
    groups.push(group);

    // Single-event groups pass through; multi-event groups become one combined event
    groups.forEach((g) => {
      if (g.length === 1) {
        result.push(g[0]);
      } else {
        const starts = g.map((e) => new Date(e.start));
        const ends = g.map((e) => new Date(e.end));
        result.push({
          id: `grp-${g.map((e) => e.id).join('-')}`,
          title: `${g.length} Visits`,
          start: new Date(Math.min(...starts)).toISOString(),
          end: new Date(Math.max(...ends)).toISOString(),
          backgroundColor: '#2d3f8e',
          borderColor: 'transparent',
          extendedProps: {
            isGroup: true,
            groupVisits: g.map((e) => e.extendedProps.visit),
            count: g.length,
          },
        });
      }
    });
  });

  return result;
}

function Dashboard() {
  // ── State ──
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefillDate, setPrefillDate] = useState(''); // passed to AddVisitModal when clicking a date
  const [selectedVisit, setSelectedVisit] = useState(null); // opens VisitDetailModal
  const [tooltip, setTooltip] = useState(null); // hover tooltip data — null when hidden
  const [currentView, setCurrentView] = useState('dayGridMonth'); // tracks active calendar view
  const tooltipTimeout = useRef(null); // delay ref so tooltip stays open when mouse moves onto it

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

  // ── Date/time helpers ──
  const today = new Date().toISOString().split('T')[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning, Admin 👋' : hour < 17 ? 'Good afternoon, Admin 👋' : 'Good evening, Admin 👋';
  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const dateShort = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Cancelled visits today — strip the time portion since Postgres may return a full timestamp
  const cancelledToday = visits.filter((v) => {
    const visitDate = v.visit_date ? v.visit_date.split('T')[0] : v.visit_date;
    return v.status === 'cancelled' && visitDate === today;
  });

  // ── Calendar event mapping ──
  // Cancelled visits are excluded so they don't appear on the calendar grid
  const calendarEvents = visits
    .filter((v) => v.status !== 'cancelled')
    .map((v) => {
      const startDate = v.visit_date ? v.visit_date.split('T')[0] : v.visit_date;
      const endDate = v.end_date ? v.end_date.split('T')[0] : startDate;
      const isMultiDay = endDate && endDate !== startDate;

      // FullCalendar's end date is exclusive, so multi-day events need one extra day added
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
          visit: v, // store the full visit object so modals and tooltips can access all fields
        },
      };
    });

  // Pre-process events for week view — groups close/overlapping visits into single cards
  const weekViewEvents = groupWeekViewEvents(calendarEvents);

  // ── Tooltip handlers ──
  const handleEventMouseEnter = (info) => {
    // Tooltips only show in week/day views; month view and all-day rows are excluded
    if (info.view.type === 'dayGridMonth') return;
    if (info.event.allDay) return;

    clearTimeout(tooltipTimeout.current);

    // Position the tooltip to the right of the event, flipping left if it would overflow
    const rect = info.el.getBoundingClientRect();
    const tooltipWidth = 276;
    let x = rect.right + 12;
    if (x + tooltipWidth > window.innerWidth - 16) {
      x = rect.left - tooltipWidth - 12;
    }
    let y = rect.top;
    if (y + 280 > window.innerHeight - 16) {
      y = window.innerHeight - 296;
    }

    // Group events show a list of all their visits; single events show full visit details
    if (info.event.extendedProps.isGroup) {
      setTooltip({ x, y, isGroup: true, groupVisits: info.event.extendedProps.groupVisits });
    } else {
      setTooltip({ x, y, visit: info.event.extendedProps.visit });
    }
  };

  // Small delay before hiding so the user can move the mouse onto the tooltip itself
  const handleEventMouseLeave = () => {
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 120);
  };

  const handleTooltipMouseEnter = () => clearTimeout(tooltipTimeout.current);
  const handleTooltipMouseLeave = () => setTooltip(null);

  // Clicking an empty date slot pre-fills the date in the add modal
  const handleDateClick = (info) => {
    setPrefillDate(info.dateStr.slice(0, 10));
    setShowAddModal(true);
  };

  // Clicking an existing event opens the detail modal; group events only show tooltip on hover
  const handleEventClick = (info) => {
    if (info.event.extendedProps.isGroup) return;
    setSelectedVisit(info.event.extendedProps.visit);
  };

  // ── Stats calculations ──
  const todayVisits = visits.filter((v) => {
    const vDate = v.visit_date ? v.visit_date.split('T')[0] : null;
    return vDate === today;
  }).length;

  // Calculate the current week's Monday–Sunday range
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekScheduled = visits.filter((v) => {
    const d = new Date(v.visit_date);
    return v.status === 'scheduled' && d >= monday && d <= sunday;
  }).length;

  // Count unique caregivers with at least one non-cancelled visit
  const activeCaregivers = new Set(
    visits.filter((v) => v.status !== 'cancelled').map((v) => v.caregiver_id)
  ).size;

  // Previous week range for the trend badges
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

  // Returns null if there is no previous week data to compare against
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
      {/* Page header — greeting + quick-add button */}
      <div className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-greeting">{greeting}</h1>
          <p className="dash-date">{dateLabel}</p>
        </div>
        <button className="btn-new-visit" onClick={() => setShowAddModal(true)}>
          + New Visit
        </button>
      </div>

      {/* Stats row — visits today, this week, and active caregivers */}
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
          // Week view uses grouped events; all other views use the standard event list
          events={currentView === 'timeGridWeek' ? weekViewEvents : calendarEvents}
          datesSet={(info) => setCurrentView(info.view.type)}
          eventBackgroundColor="#2d3f8e"
          eventBorderColor="transparent"
          eventDisplay="block"
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventMouseEnter={handleEventMouseEnter}
          eventMouseLeave={handleEventMouseLeave}
          eventMaxStack={3}
          slotEventOverlap={false}
          eventMinHeight={40}
          eventContent={(arg) => {
            const isMonthView = arg.view.type === 'dayGridMonth';

            // Month view — compact bar with caregiver name and time range
            if (isMonthView) {
              const v = arg.event.extendedProps.visit;
              const timeStr = v ? `${formatTime(v.start_time)} – ${formatTime(v.end_time)}` : '';
              return (
                <div style={{
                  padding: '2px 6px',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: 0,
                }}>
                  <span style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 700,
                    fontSize: '11px',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flexShrink: 0,
                    maxWidth: timeStr ? '55%' : '100%',
                  }}>
                    {arg.event.extendedProps.caregiverName}
                  </span>
                  {timeStr && (
                    <>
                      <span style={{
                        fontFamily: 'Spartan, sans-serif',
                        fontWeight: 400,
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.6)',
                        flexShrink: 0,
                      }}>·</span>
                      <span style={{
                        fontFamily: 'Spartan, sans-serif',
                        fontWeight: 400,
                        fontSize: '10px',
                        color: 'rgba(255,255,255,0.7)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}>
                        {timeStr}
                      </span>
                    </>
                  )}
                </div>
              );
            }

            // All-day row — used for multi-day visits in week/day view
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

            // Week view grouped event — shows visit count and up to 2 caregiver names
            if (arg.event.extendedProps.isGroup) {
              const { count, groupVisits } = arg.event.extendedProps;
              return (
                <div style={{
                  background: 'rgba(45, 63, 142, 0.13)',
                  borderLeft: '3px solid #2d3f8e',
                  borderRadius: '0 0.5rem 0.5rem 0',
                  height: '100%',
                  width: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  boxSizing: 'border-box',
                  padding: '6px 8px',
                  gap: '2px',
                }}>
                  <div style={{ fontFamily: 'Spartan, sans-serif', fontWeight: 700, fontSize: '12px', color: '#1a1a2e' }}>
                    {count} Visits
                  </div>
                  {groupVisits.slice(0, 2).map((v, i) => (
                    <div key={i} style={{ fontFamily: 'Spartan, sans-serif', fontWeight: 400, fontSize: '10px', color: '#4a4a6a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.caregiver_name}
                    </div>
                  ))}
                  {/* Show overflow count if there are more than 2 caregivers in the group */}
                  {groupVisits.length > 2 && (
                    <div style={{ fontFamily: 'Spartan, sans-serif', fontWeight: 400, fontSize: '10px', color: '#9090a0' }}>
                      +{groupVisits.length - 2} more
                    </div>
                  )}
                </div>
              );
            }

            // Week / Day view — use a compact layout for short events (≤2 hrs)
            const durationMs = arg.event.end && arg.event.start
              ? arg.event.end - arg.event.start
              : 0;
            const isShort = durationMs > 0 && durationMs <= 2 * 60 * 60 * 1000;

            // Shared card style: light navy tint with a left border accent
            const cardStyle = {
              background: 'rgba(45, 63, 142, 0.08)',
              borderLeft: '3px solid #2d3f8e',
              borderRadius: '0 0.5rem 0.5rem 0',
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              boxSizing: 'border-box',
            };

            // Short event — just caregiver name and time on one line
            if (isShort) {
              return (
                <div style={{ ...cardStyle, padding: '3px 7px', justifyContent: 'center' }}>
                  <div style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 700,
                    fontSize: '11px',
                    color: '#1a1a2e',
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
                    color: '#6a6a8a',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatEventTime(arg.event.start)} – {formatEventTime(arg.event.end)}
                  </div>
                </div>
              );
            }

            // Longer event — full card with time, caregiver, client, and service type
            return (
              <div style={{ ...cardStyle, padding: '6px 8px', gap: '2px' }}>
                <div style={{
                  fontFamily: 'Spartan, sans-serif',
                  fontWeight: 400,
                  fontSize: '10px',
                  color: '#6a6a8a',
                  letterSpacing: '0.02em',
                }}>
                  {formatEventTime(arg.event.start)} – {formatEventTime(arg.event.end)}
                </div>
                <div style={{
                  fontFamily: 'Spartan, sans-serif',
                  fontWeight: 700,
                  fontSize: '12px',
                  color: '#1a1a2e',
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
                  color: '#4a4a6a',
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
                    color: '#2d3f8e',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: '2px',
                  }}>
                    {arg.event.extendedProps.serviceType}
                  </div>
                )}
              </div>
            );
          }}
          height="auto"
        />
      </div>

      {/* Add Visit modal */}
      {showAddModal && (
        <AddVisitModal
          onClose={() => { setShowAddModal(false); setPrefillDate(''); }}
          onSuccess={fetchVisits}
          prefillDate={prefillDate}
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

      {/* Hover tooltip — renders outside the calendar so it isn't clipped by overflow */}
      {tooltip && (
        <div
          className="visit-tooltip"
          style={{ top: tooltip.y, left: tooltip.x }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {tooltip.isGroup ? (
            // Group tooltip — lists each visit with caregiver, client, and service
            <>
              <p className="visit-tooltip-time">{tooltip.groupVisits.length} Visits</p>
              {tooltip.groupVisits.map((v, i) => (
                <div key={i} className="visit-tooltip-row" style={{ alignItems: 'flex-start', marginBottom: i < tooltip.groupVisits.length - 1 ? '0.75rem' : 0 }}>
                  <div className="visit-tooltip-avatar visit-tooltip-avatar--caregiver" style={{ marginTop: '0.125rem' }}>
                    {v.caregiver_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="visit-tooltip-name">{v.caregiver_name}</p>
                    <p className="visit-tooltip-label">{v.client_name}</p>
                    {v.service_type && (
                      <p className="visit-tooltip-label" style={{ color: '#2d3f8e', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.625rem', letterSpacing: '0.05em' }}>
                        {v.service_type}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            // Single visit tooltip — full details with a link to open the detail modal
            <>
              <p className="visit-tooltip-time">
                {formatTime(tooltip.visit.start_time)} – {formatTime(tooltip.visit.end_time)}
              </p>
              <div className="visit-tooltip-row">
                <div className="visit-tooltip-avatar visit-tooltip-avatar--caregiver">
                  {tooltip.visit.caregiver_name?.charAt(0)}
                </div>
                <div>
                  <p className="visit-tooltip-name">{tooltip.visit.caregiver_name}</p>
                  <p className="visit-tooltip-label">Primary Caregiver</p>
                </div>
              </div>
              <div className="visit-tooltip-row">
                <div className="visit-tooltip-avatar visit-tooltip-avatar--client">
                  {tooltip.visit.client_name?.charAt(0)}
                </div>
                <div>
                  <p className="visit-tooltip-name">{tooltip.visit.client_name}</p>
                  <p className="visit-tooltip-label">Client</p>
                </div>
              </div>
              {tooltip.visit.service_type && (
                <div className="visit-tooltip-row">
                  <div className="visit-tooltip-icon-wrap">♥</div>
                  <div>
                    <p className="visit-tooltip-name">{tooltip.visit.service_type}</p>
                    <p className="visit-tooltip-label">Service Type</p>
                  </div>
                </div>
              )}
              <div className="visit-tooltip-row">
                <div className="visit-tooltip-icon-wrap">⏱</div>
                <div>
                  <p className="visit-tooltip-name">{formatDuration(tooltip.visit.start_time, tooltip.visit.end_time)}</p>
                  <p className="visit-tooltip-label">Duration</p>
                </div>
              </div>
              <div className="visit-tooltip-row">
                <div className={`visit-tooltip-status-dot visit-tooltip-status-dot--${tooltip.visit.status}`} />
                <div>
                  <p className="visit-tooltip-name" style={{ textTransform: 'capitalize' }}>
                    {tooltip.visit.status?.replace('_', ' ')}
                  </p>
                  <p className="visit-tooltip-label">Status</p>
                </div>
              </div>
              <button
                className="visit-tooltip-details-btn"
                onClick={() => { setSelectedVisit(tooltip.visit); setTooltip(null); }}
              >
                View details <span>›</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
