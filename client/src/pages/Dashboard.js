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

// Compact time label for month view pills: "9:00am", "9:30am", "1:00pm", etc.
function formatTimeShort(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 || 12;
  return `${display}:${m}${ampm}`;
}

// Formats a Date as 'YYYY-MM-DD' in local time — avoids UTC-shift bugs from toISOString()
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

// Returns a human-readable duration for a visit — day count for multi-day, hours for single-day
function formatVisitDuration(visit) {
  const startDate = visit.visit_date ? visit.visit_date.split('T')[0] : null;
  const endDate = visit.end_date ? visit.end_date.split('T')[0] : null;
  const isMultiDay = endDate && endDate !== startDate;
  if (isMultiDay) {
    const days = Math.round(
      (new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')) / 86400000
    ) + 1;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  return formatDuration(visit.start_time, visit.end_time);
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

// Shared single-visit tooltip content — used for both direct hover and group item branch
function VisitTooltipBody({ visit }) {
  return (
    <>
      <p className="visit-tooltip-time">
        {formatTime(visit.start_time)} – {formatTime(visit.end_time)}
      </p>
      <div className="visit-tooltip-row">
        <div className="visit-tooltip-avatar visit-tooltip-avatar--caregiver">
          {visit.caregiver_name?.charAt(0)}
        </div>
        <div>
          <p className="visit-tooltip-name">{visit.caregiver_name}</p>
          <p className="visit-tooltip-label">Primary Caregiver</p>
        </div>
      </div>
      <div className="visit-tooltip-row">
        <div className="visit-tooltip-avatar visit-tooltip-avatar--client">
          {visit.client_name?.charAt(0)}
        </div>
        <div>
          <p className="visit-tooltip-name">{visit.client_name}</p>
          <p className="visit-tooltip-label">Client</p>
        </div>
      </div>
      {visit.service_type && (
        <div className="visit-tooltip-row">
          <div className="visit-tooltip-icon-wrap">♥</div>
          <div>
            <p className="visit-tooltip-name">{visit.service_type}</p>
            <p className="visit-tooltip-label">Service Type</p>
          </div>
        </div>
      )}
      <div className="visit-tooltip-row">
        <div className="visit-tooltip-icon-wrap">⏱</div>
        <div>
          <p className="visit-tooltip-name">{formatVisitDuration(visit)}</p>
          <p className="visit-tooltip-label">Duration</p>
        </div>
      </div>
      <div className="visit-tooltip-row">
        <div className={`visit-tooltip-status-dot visit-tooltip-status-dot--${visit.status}`} />
        <div>
          <p className="visit-tooltip-name" style={{ textTransform: 'capitalize' }}>
            {visit.status?.replace('_', ' ')}
          </p>
          <p className="visit-tooltip-label">Status</p>
        </div>
      </div>
    </>
  );
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
  const [subTooltip, setSubTooltip] = useState(null); // branching tooltip from a group item
  const [currentView, setCurrentView] = useState('dayGridMonth'); // tracks active calendar view
  const tooltipTimeout = useRef(null);
  const subTooltipTimeout = useRef(null);
  const pendingTooltipRef = useRef(null); // hoverIntent timer — cancels if mouse leaves quickly
  const tooltipOpenRef = useRef(false);   // tracks whether a tooltip is visible (for hoverIntent)
  // Prevents other calendar events from hijacking the tooltip while the user is reading it
  const mouseOnTooltip = useRef(false);

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
  const today = toDateStr(new Date());

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

  // ── Tooltip positioning helper ──
  const calcTooltipPos = (rect, width = 276, height = 300) => {
    const sidebarEl = document.querySelector('.sidebar');
    const sidebarWidth = (sidebarEl?.getBoundingClientRect().width ?? 240) + 16;
    let x = rect.right + 12;
    if (x + width > window.innerWidth - 16) x = rect.left - width - 12;
    x = Math.max(x, sidebarWidth);
    let y = rect.top;
    if (y + height > window.innerHeight - 16) y = window.innerHeight - height - 16;
    return { x, y };
  };

  // ── Tooltip handlers ──
  const handleEventMouseEnter = (info) => {
    if (mouseOnTooltip.current) return;
    clearTimeout(tooltipTimeout.current);
    clearTimeout(pendingTooltipRef.current);

    const show = () => {
      const { x, y } = calcTooltipPos(info.el.getBoundingClientRect());
      if (info.event.extendedProps.isGroup) {
        setTooltip({ x, y, isGroup: true, groupVisits: info.event.extendedProps.groupVisits });
      } else {
        setTooltip({ x, y, visit: info.event.extendedProps.visit });
      }
      tooltipOpenRef.current = true;
    };

    // When another tooltip is already open, wait briefly before switching so that
    // brushing past a neighboring card while moving toward the tooltip doesn't hijack it
    if (tooltipOpenRef.current) {
      pendingTooltipRef.current = setTimeout(show, 150);
    } else {
      show();
    }
  };

  // 400 ms grace period — enough time to move the mouse from a small pill to the tooltip
  const handleEventMouseLeave = () => {
    clearTimeout(pendingTooltipRef.current);
    tooltipTimeout.current = setTimeout(() => {
      mouseOnTooltip.current = false; // always reset — prevents stuck state if mouse returned to the card
      tooltipOpenRef.current = false;
      setTooltip(null);
      setSubTooltip(null);
    }, 400);
  };

  const handleTooltipMouseEnter = () => {
    mouseOnTooltip.current = true;
    clearTimeout(tooltipTimeout.current);
    clearTimeout(subTooltipTimeout.current);
  };
  const handleTooltipMouseLeave = () => {
    mouseOnTooltip.current = false;
    // Give time to reach the sub-tooltip before closing either tooltip
    subTooltipTimeout.current = setTimeout(() => setSubTooltip(null), 300);
    tooltipTimeout.current = setTimeout(() => {
      tooltipOpenRef.current = false;
      setTooltip(null);
    }, 300);
  };

  // ── Group-item hover → branching sub-tooltip ──
  const handleGroupItemMouseEnter = (e, visit) => {
    clearTimeout(subTooltipTimeout.current);
    clearTimeout(tooltipTimeout.current);
    const { x, y } = calcTooltipPos(e.currentTarget.getBoundingClientRect());
    setSubTooltip({ x, y, visit });
  };
  const handleGroupItemMouseLeave = () => {
    subTooltipTimeout.current = setTimeout(() => setSubTooltip(null), 300);
  };
  const handleSubTooltipMouseEnter = () => {
    mouseOnTooltip.current = true;
    clearTimeout(subTooltipTimeout.current);
    clearTimeout(tooltipTimeout.current);
  };
  const handleSubTooltipMouseLeave = () => {
    mouseOnTooltip.current = false;
    setSubTooltip(null);
    tooltipTimeout.current = setTimeout(() => {
      tooltipOpenRef.current = false;
      setTooltip(null);
    }, 150);
  };

  // Clicking an empty date slot pre-fills the date in the add modal
  const handleDateClick = (info) => {
    setPrefillDate(info.dateStr.slice(0, 10));
    setShowAddModal(true);
  };

  // Resets all tooltip state — used whenever the tooltip is dismissed programmatically
  // so mouseOnTooltip doesn't stay stuck true and block future hovers
  const closeTooltips = () => {
    mouseOnTooltip.current = false;
    tooltipOpenRef.current = false;
    clearTimeout(tooltipTimeout.current);
    clearTimeout(subTooltipTimeout.current);
    clearTimeout(pendingTooltipRef.current);
    setTooltip(null);
    setSubTooltip(null);
  };

  // Clicking an existing event opens the detail modal; group events only show tooltip on hover
  const handleEventClick = (info) => {
    if (info.event.extendedProps.isGroup) return;
    closeTooltips();
    setSelectedVisit(info.event.extendedProps.visit);
  };

  // ── Stats calculations ──

  // Current week Sunday–Saturday
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // back to Sunday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // forward to Saturday

  const weekStartStr = toDateStr(weekStart);
  const weekEndStr   = toDateStr(weekEnd);

  const weekRangeLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // A visit counts if it isn't cancelled and overlaps the target date or range.
  // Multi-day visits (24/7 care) count for every day they span.
  const visitOverlapsDate = (v, dateStr) => {
    const start = v.visit_date ? v.visit_date.split('T')[0] : null;
    const end   = v.end_date   ? v.end_date.split('T')[0]   : start;
    return v.status !== 'cancelled' && start <= dateStr && end >= dateStr;
  };

  const visitOverlapsRange = (v, rangeStart, rangeEnd) => {
    const start = v.visit_date ? v.visit_date.split('T')[0] : null;
    const end   = v.end_date   ? v.end_date.split('T')[0]   : start;
    return v.status !== 'cancelled' && start <= rangeEnd && end >= rangeStart;
  };

  const todayVisits   = visits.filter((v) => visitOverlapsDate(v, today)).length;
  const weekVisits    = visits.filter((v) => visitOverlapsRange(v, weekStartStr, weekEndStr)).length;

  // Count unique caregivers with at least one non-cancelled visit
  const activeCaregivers = new Set(
    visits.filter((v) => v.status !== 'cancelled').map((v) => v.caregiver_id)
  ).size;

  // Previous week (Sun–Sat) for trend badges
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setDate(weekStart.getDate() - 7);
  const prevWeekEnd = new Date(weekEnd);
  prevWeekEnd.setDate(weekEnd.getDate() - 7);
  const prevWeekStartStr = toDateStr(prevWeekStart);
  const prevWeekEndStr   = toDateStr(prevWeekEnd);

  const prevWeekVisits = visits.filter((v) => visitOverlapsRange(v, prevWeekStartStr, prevWeekEndStr)).length;

  const prevActiveCaregivers = new Set(
    visits.filter((v) => visitOverlapsRange(v, prevWeekStartStr, prevWeekEndStr)).map((v) => v.caregiver_id)
  ).size;

  function pctChange(current, previous) {
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }

  const weekPct = pctChange(weekVisits, prevWeekVisits);
  const caregiverPct = pctChange(activeCaregivers, prevActiveCaregivers);

  if (loading) return <p className="state-loading">Loading...</p>;
  if (error)   return <p className="state-error">Something went wrong.</p>;

  return (
    <div className="dashboard-root">
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

      {/* Stats row — visits today, visits this week, and active caregivers */}
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
            <p className="stat-sub">{dateShort}</p>
          </div>
          <div className="stat-watermark" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
            <p className="stat-number">{weekVisits}</p>
            <p className="stat-label">Visits This Week</p>
            <p className="stat-sub">{weekRangeLabel}</p>
            {weekPct !== null && (
              <span className={`stat-change ${weekPct >= 0 ? 'stat-change--pos' : 'stat-change--neg'}`}>
                {weekPct > 0 ? '+' : ''}{weekPct}% vs last week
              </span>
            )}
          </div>
          <div className="stat-watermark" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
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
          <div className="stat-watermark" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
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
            left: '',
            center: 'prev,title,next',
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

            // Month view — pill with avatar initials + caregiver name + time right-aligned
            if (isMonthView) {
              const initials = arg.event.extendedProps.caregiverName
                ? arg.event.extendedProps.caregiverName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                : '?';
              const visit = arg.event.extendedProps.visit;
              const timeLabel = visit?.start_time
                ? `${formatTimeShort(visit.start_time)}–${formatTimeShort(visit.end_time)}`
                : '';
              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '0.1875rem 0.4rem 0.1875rem 0.25rem',
                  width: '100%',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: '50%',
                    background: '#2d3f8e',
                    color: '#ffffff',
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    fontFamily: 'Spartan, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,0.15)',
                  }}>
                    {initials}
                  </div>
                  <span style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.6875rem',
                    color: '#1a2f6e',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {arg.event.extendedProps.caregiverName}
                  </span>
                  {timeLabel && (
                    <span style={{
                      flexShrink: 0,
                      fontFamily: 'Spartan, sans-serif',
                      fontWeight: 600,
                      fontSize: '0.5625rem',
                      color: '#5e6ea8',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.01em',
                    }}>
                      {timeLabel}
                    </span>
                  )}
                </div>
              );
            }

            // All-day row — used for multi-day visits in week/day view
            if (arg.event.allDay) {
              return (
                <div style={{ padding: '0.1875rem 0.5rem 0.1875rem 0.25rem', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '0.375rem', width: '100%' }}>
                  <div style={{
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: '50%',
                    background: '#2d3f8e',
                    color: '#ffffff',
                    fontSize: '0.5625rem',
                    fontWeight: 700,
                    fontFamily: 'Spartan, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 0.0625rem 0.1875rem rgba(0,0,0,0.15)',
                  }}>
                    {arg.event.extendedProps.caregiverName
                      ? arg.event.extendedProps.caregiverName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      : '?'}
                  </div>
                  <div style={{ overflow: 'hidden', minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'Spartan, sans-serif',
                      fontWeight: 700,
                      fontSize: '0.6875rem',
                      color: '#1a2f6e',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {arg.event.extendedProps.caregiverName}
                    </div>
                    {arg.event.extendedProps.clientName && (
                      <div style={{
                        fontFamily: 'Spartan, sans-serif',
                        fontWeight: 400,
                        fontSize: '0.625rem',
                        color: '#484858',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {arg.event.extendedProps.clientName}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Week view grouped event — shows visit count and up to 2 caregiver names
            if (arg.event.extendedProps.isGroup) {
              const { count, groupVisits } = arg.event.extendedProps;
              return (
                <div style={{
                  background: 'rgba(45, 63, 142, 0.13)',
                  borderLeft: '0.1875rem solid #2d3f8e',
                  borderRadius: '0 0.5rem 0.5rem 0',
                  height: '100%',
                  width: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  boxSizing: 'border-box',
                  padding: '0.375rem 0.5rem',
                  gap: '0.125rem',
                }}>
                  <div style={{ fontFamily: 'Spartan, sans-serif', fontWeight: 700, fontSize: '0.75rem', color: '#1a1a2e' }}>
                    {count} Visits
                  </div>
                  {groupVisits.slice(0, 2).map((v, i) => (
                    <div key={i} style={{ fontFamily: 'Spartan, sans-serif', fontWeight: 400, fontSize: '0.625rem', color: '#4a4a6a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {v.caregiver_name}
                      <span style={{ color: '#484858', margin: '0 0.1875rem' }}>·</span>
                      {formatTime(v.start_time)} – {formatTime(v.end_time)}
                    </div>
                  ))}
                  {/* Show overflow count if there are more than 2 caregivers in the group */}
                  {groupVisits.length > 2 && (
                    <div style={{ fontFamily: 'Spartan, sans-serif', fontWeight: 400, fontSize: '0.625rem', color: '#484858' }}>
                      +{groupVisits.length - 2} more
                    </div>
                  )}
                </div>
              );
            }

            // Week / Day view — full card with time, caregiver, client, and service type
            const cardStyle = {
              background: 'rgba(45, 63, 142, 0.08)',
              borderLeft: '0.1875rem solid #2d3f8e',
              borderRadius: '0 0.5rem 0.5rem 0',
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              boxSizing: 'border-box',
            };

            const durationMins = (arg.event.end - arg.event.start) / 60000;
            const showServiceType = durationMins >= 90;

            return (
              <div style={{ ...cardStyle, padding: '0.375rem 0.5rem', gap: '0.125rem' }}>
                <div style={{
                  fontFamily: 'Spartan, sans-serif',
                  fontWeight: 400,
                  fontSize: '0.625rem',
                  color: '#484858',
                  letterSpacing: '0.02em',
                }}>
                  {formatEventTime(arg.event.start)} – {formatEventTime(arg.event.end)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden' }}>
                  {/* Caregiver: user-plus icon */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2d3f8e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/>
                    <line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                  <div style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: '#1a1a2e',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {arg.event.extendedProps.caregiverName}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden' }}>
                  {/* Client: plain user icon */}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6a6a8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  <div style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 400,
                    fontSize: '0.6875rem',
                    color: '#4a4a6a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {arg.event.extendedProps.clientName}
                  </div>
                </div>
                {showServiceType && arg.event.extendedProps.serviceType && (
                  <div style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 700,
                    fontSize: '0.5625rem',
                    color: '#2d3f8e',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginTop: '0.125rem',
                  }}>
                    {arg.event.extendedProps.serviceType}
                  </div>
                )}
              </div>
            );
          }}
          stickyHeaderDates={false}
          height="100%"
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

      {/* Main hover tooltip — single visit or group list */}
      {tooltip && (
        <div
          className="visit-tooltip"
          style={{ top: tooltip.y, left: tooltip.x }}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {tooltip.isGroup ? (
            <>
              <p className="visit-tooltip-time">{tooltip.groupVisits.length} Visits</p>
              {tooltip.groupVisits.map((v, i) => (
                <div
                  key={i}
                  className="visit-tooltip-group-item"
                  onMouseEnter={(e) => handleGroupItemMouseEnter(e, v)}
                  onMouseLeave={handleGroupItemMouseLeave}
                >
                  <div className="visit-tooltip-row" style={{ marginBottom: 0 }}>
                    <div className="visit-tooltip-avatar visit-tooltip-avatar--caregiver">
                      {v.caregiver_name?.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="visit-tooltip-name">{v.caregiver_name}</p>
                      <p className="visit-tooltip-label">{v.client_name}</p>
                      <p className="visit-tooltip-label">{formatTime(v.start_time)} – {formatTime(v.end_time)}</p>
                    </div>
                    <span className="visit-tooltip-group-arrow">›</span>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <VisitTooltipBody visit={tooltip.visit} />
          )}
        </div>
      )}

      {/* Branching sub-tooltip — appears when hovering a row inside the group tooltip */}
      {subTooltip && (
        <div
          className="visit-tooltip"
          style={{ top: subTooltip.y, left: subTooltip.x }}
          onMouseEnter={handleSubTooltipMouseEnter}
          onMouseLeave={handleSubTooltipMouseLeave}
        >
          <VisitTooltipBody visit={subTooltip.visit} />
        </div>
      )}
    </div>
  );
}

export default Dashboard;
