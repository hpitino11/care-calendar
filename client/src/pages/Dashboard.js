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
  scheduled:   '#3a54a4',
  in_progress: '#f8a8a7',
  completed:   '#9090a0',
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

  const today = new Date().toISOString().slice(0, 10);

  // Cancelled visits today — shown in the bar above the calendar
  const cancelledToday = visits.filter(
    (v) => v.status === 'cancelled' && v.visit_date?.slice(0, 10) === today
  );

  // Cancelled visits are excluded from the calendar grid
  const calendarEvents = visits
    .filter((v) => v.status !== 'cancelled')
    .map((v) => ({
      id: String(v.id),
      title: v.caregiver_name,
      start: `${v.visit_date?.slice(0, 10)}T${v.start_time}`,
      end:   `${v.visit_date?.slice(0, 10)}T${v.end_time}`,
      backgroundColor: STATUS_COLORS[v.status] || STATUS_COLORS.scheduled,
      borderColor: 'transparent',
      extendedProps: {
        caregiverName: v.caregiver_name,
        clientName: v.client_name,
        visit: v,
      },
    }));

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
  const todayVisits = visits.filter((v) => v.visit_date?.slice(0, 10) === today).length;

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

  if (loading) return <p className="state-loading">Loading...</p>;
  if (error)   return <p className="state-error">Something went wrong.</p>;

  return (
    <div>
      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-icon">📅</span>
          <p className="stat-number">{todayVisits}</p>
          <p className="stat-label">Visits today</p>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📋</span>
          <p className="stat-number">{weekScheduled}</p>
          <p className="stat-label">Scheduled this week</p>
        </div>
        <div className="stat-card">
          <span className="stat-icon">👥</span>
          <p className="stat-number">{activeCaregivers}</p>
          <p className="stat-label">Caregivers active</p>
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
            return (
              <div style={{ padding: '2px 4px', overflow: 'hidden' }}>
                <div style={{
                  fontFamily: 'Spartan, sans-serif',
                  fontWeight: 700,
                  fontSize: isMonthView ? '11px' : '12px',
                  color: '#8aa9d7',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {arg.event.extendedProps.caregiverName}
                </div>
                {!isMonthView && (
                  <div style={{
                    fontFamily: 'Spartan, sans-serif',
                    fontWeight: 400,
                    fontSize: '11px',
                    color: 'rgba(138, 169, 215, 0.75)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '1px',
                  }}>
                    {arg.event.extendedProps.clientName}
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
