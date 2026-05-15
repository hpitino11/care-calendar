import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import BASE_URL from '../api';

// Statuses that can be assigned to a visit
const VALID_STATUSES = ['scheduled', 'completed', 'cancelled'];

// Service types offered by Village Caregiving
const SERVICES = [
  'Respite Care',
  'Hygiene Assistance',
  'Bathing Assistance',
  'Ambulation Assistance',
  'Companion',
  'Laundry Assistance',
  'Light Housekeeping',
  'Cooking Assistance',
  'Errand Assistance',
  "Alzheimer's and Dementia Care",
  'Veteran Care',
  '24/7 Care',
];

// Generates time options in 15-minute increments from 6:00 AM to 10:00 PM
function generateTimeOptions() {
  const options = [];
  for (let hour = 6; hour <= 22; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const value = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const label = `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:${String(min).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
      options.push({ value, label });
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

function isStartBlocked(time, bookedSlots) {
  return bookedSlots.some(({ start_time, end_time }) => {
    const s = start_time.slice(0, 5);
    const e = end_time.slice(0, 5);
    return time >= s && time < e;
  });
}

function isEndBlocked(time, startTime, bookedSlots) {
  if (!startTime) return false;
  return bookedSlots.some(({ start_time, end_time }) => {
    const bs = start_time.slice(0, 5);
    const be = end_time.slice(0, 5);
    return startTime < be && time > bs;
  });
}

// Formats a date string to a human-readable format, e.g. "Wed, May 14, 2025"
function formatFullDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function VisitDetailModal({ visit, onClose, onSuccess }) {
  // ── State ──
  const [status, setStatus] = useState(visit.status); // status-only update (quick change)
  const [editMode, setEditMode] = useState(false); // switches between detail view and edit form
  const [editForm, setEditForm] = useState({});
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [editDateError, setEditDateError] = useState('');
  const [conflictError, setConflictError] = useState('');
  const [bookedSlots, setBookedSlots] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [clients, setClients] = useState([]);

  // ── Edit form setup ──
  // Pre-fills the edit form with existing visit data when edit mode is activated.
  // Also detects whether the visit is multi-day so the end date field shows correctly.
  useEffect(() => {
    if (!editMode) return;
    const startDate = visit.visit_date ? visit.visit_date.split('T')[0] : '';
    const endDate = visit.end_date ? visit.end_date.split('T')[0] : '';
    const multiDay = Boolean(endDate && endDate !== startDate);
    setIsMultiDay(multiDay);
    setEditForm({
      caregiver_id: visit.caregiver_id || '',
      client_id: visit.client_id || '',
      visit_date: startDate,
      end_date: multiDay ? endDate : '',
      start_time: visit.start_time ? visit.start_time.slice(0, 5) : '', // trim seconds if present
      end_time: visit.end_time ? visit.end_time.slice(0, 5) : '',
      status: visit.status || 'scheduled',
      notes: visit.notes || '',
      service_type: visit.service_type || '',
    });
  }, [editMode, visit]);

  // ── Dropdown loading ──
  // Fetch caregiver and client lists in parallel when edit mode opens
  useEffect(() => {
    if (!editMode) return;
    const fetchDropdowns = async () => {
      try {
        const [cgRes, clRes] = await Promise.all([
          fetch(`${BASE_URL}/api/caregivers`),
          fetch(`${BASE_URL}/api/clients`),
        ]);
        setCaregivers(await cgRes.json());
        setClients(await clRes.json());
      } catch (err) {
        console.error('Failed to load dropdowns', err);
      }
    };
    fetchDropdowns();
  }, [editMode]);

  // ── Fetch booked slots when caregiver or date changes in edit form ──
  useEffect(() => {
    if (!editMode || !editForm.caregiver_id || !editForm.visit_date) {
      setBookedSlots([]);
      return;
    }
    const fetchSlots = async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/visits/caregiver-slots?caregiver_id=${editForm.caregiver_id}&date=${editForm.visit_date}`
        );
        const slots = await res.json();
        // Exclude the current visit's own time slot so it doesn't block itself
        setBookedSlots(slots.filter(s =>
          s.start_time.slice(0, 5) !== visit.start_time?.slice(0, 5) ||
          s.end_time.slice(0, 5)   !== visit.end_time?.slice(0, 5)
        ));
      } catch (err) {
        console.error('Failed to load caregiver availability', err);
      }
    };
    fetchSlots();
  }, [editMode, editForm.caregiver_id, editForm.visit_date]);

  // ── Action handlers ──

  // Quick status update — only sends the status field, leaves all other visit data unchanged
  const handleStatusUpdate = async () => {
    try {
      await fetch(`${BASE_URL}/api/visits/${visit.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this visit?')) return;
    try {
      await fetch(`${BASE_URL}/api/visits/${visit.id}`, { method: 'DELETE' });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...editForm, [name]: value };
    if (name === 'caregiver_id' || name === 'visit_date') {
      updated.start_time = '';
      updated.end_time = '';
    }
    if (name === 'start_time' && editForm.end_time && editForm.end_time <= value) {
      updated.end_time = '';
    }
    setEditForm(updated);
    setConflictError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    // Validate the end date before submitting a multi-day edit
    if (isMultiDay && !editForm.end_date) {
      setEditDateError('Please select an end date.');
      return;
    }

    if (isMultiDay && editForm.end_date < editForm.visit_date) {
      setEditDateError('End date must be after start date.');
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}/api/visits/${visit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          end_date: editForm.end_date || editForm.visit_date,
        }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setConflictError(data.message);
        return;
      }
      if (!res.ok) throw new Error('Request failed');
      onSuccess();
      onClose();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  // ── Date display values ──
  const startDate = visit.visit_date ? visit.visit_date.split('T')[0] : null;
  const endDate = visit.end_date ? visit.end_date.split('T')[0] : null;
  const visitIsMultiDay = endDate && endDate !== startDate;

  // For multi-day visits, count inclusive days (start date through end date)
  const dayCount = visitIsMultiDay
    ? Math.round((new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')) / 86400000) + 1
    : null;

  // ── Edit mode — renders a full edit form instead of the detail view ──
  if (editMode) {
    return (
      <Modal onClose={onClose}>
        <h2 className="modal-title">Edit Visit</h2>
        <form onSubmit={handleEditSubmit} className="form">
          <div className="form-group">
            <label>Caregiver *</label>
            <select name="caregiver_id" value={editForm.caregiver_id} onChange={handleEditChange} required>
              <option value="">Select caregiver</option>
              {caregivers.map((cg) => (
                <option key={cg.id} value={cg.id}>{cg.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Client *</label>
            <select name="client_id" value={editForm.client_id} onChange={handleEditChange} required>
              <option value="">Select client</option>
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>{cl.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Service Type</label>
            <select name="service_type" value={editForm.service_type} onChange={handleEditChange}>
              <option value="">Select a service...</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Start Date *</label>
            <input
              type="date"
              name="visit_date"
              value={editForm.visit_date}
              onChange={handleEditChange}
              required
            />
          </div>

          {/* Multi-day toggle */}
          <div className="form-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={isMultiDay}
                onChange={(e) => {
                  setIsMultiDay(e.target.checked);
                  setEditDateError('');
                  if (!e.target.checked) {
                    setEditForm({ ...editForm, end_date: '' });
                  }
                }}
              />
              <span>Multi-day visit</span>
            </label>
          </div>

          {isMultiDay && (
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={editForm.end_date}
                onChange={(e) => { handleEditChange(e); setEditDateError(''); }}
                min={editForm.visit_date}
              />
              {editDateError && <p className="field-error">{editDateError}</p>}
            </div>
          )}

          <div className="form-group">
            <label>Start Time *</label>
            <select name="start_time" value={editForm.start_time} onChange={handleEditChange} required>
              <option value="">Select start time</option>
              {TIME_OPTIONS.map((opt) => {
                const blocked = isStartBlocked(opt.value, bookedSlots);
                return (
                  <option key={opt.value} value={opt.value} disabled={blocked}>
                    {opt.label}{blocked ? ' — already booked' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="form-group">
            <label>End Time *</label>
            <select name="end_time" value={editForm.end_time} onChange={handleEditChange} required>
              <option value="">Select end time</option>
              {TIME_OPTIONS
                .filter((opt) => !editForm.start_time || opt.value > editForm.start_time)
                .map((opt) => {
                  const blocked = isEndBlocked(opt.value, editForm.start_time, bookedSlots);
                  return (
                    <option key={opt.value} value={opt.value} disabled={blocked}>
                      {opt.label}{blocked ? ' — conflict' : ''}
                    </option>
                  );
                })}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select name="status" value={editForm.status} onChange={handleEditChange}>
              {VALID_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea
              name="notes"
              value={editForm.notes}
              onChange={handleEditChange}
              placeholder="Optional notes..."
              rows={3}
            />
          </div>
          {conflictError && <p className="form-conflict-error">{conflictError}</p>}

          <div className="form-actions">
            <button type="submit" className="btn-submit">Save Changes</button>
            <button type="button" className="btn-cancel" onClick={() => setEditMode(false)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    );
  }

  // ── Detail view — read-only summary with a quick status update and action buttons ──
  return (
    <Modal onClose={onClose}>
      <h2 className="modal-title">Visit Details</h2>
      <div className="visit-detail">
        <p><span className="detail-label">Caregiver</span> {visit.caregiver_name || '—'}</p>
        <p><span className="detail-label">Client</span> {visit.client_name || '—'}</p>
        {visit.service_type && (
          <div className="detail-field">
            <span className="detail-label">Service</span>
            <span className="visit-service-tag">{visit.service_type}</span>
          </div>
        )}
        <div className="detail-field">
          <span className="detail-label">Date</span>
          <span>
            {startDate ? formatFullDate(startDate) : '—'}
            {/* Show end date and a multi-day badge if the visit spans multiple days */}
            {visitIsMultiDay && (
              <>
                <span style={{ color: '#f14e4b', margin: '0 6px' }}>→</span>
                {formatFullDate(endDate)}
                <span style={{
                  display: 'inline-block',
                  marginLeft: '8px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#3a54a4',
                  background: 'rgba(58,84,164,0.08)',
                  border: '1px solid rgba(58,84,164,0.15)',
                  borderRadius: '20px',
                  padding: '2px 8px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  Multi-day
                </span>
              </>
            )}
          </span>
        </div>
        <p><span className="detail-label">Time</span> {visit.start_time} – {visit.end_time}</p>
        {visitIsMultiDay && (
          <p><span className="detail-label">Duration</span> {dayCount} {dayCount === 1 ? 'day' : 'days'}</p>
        )}
        {visit.notes && <p><span className="detail-label">Notes</span> {visit.notes}</p>}
      </div>

      {/* Quick status update — saves only the status without opening the full edit form */}
      <div className="form-group" style={{ marginTop: '20px' }}>
        <label>Update Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {VALID_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="form-actions" style={{ marginTop: '20px' }}>
        <button className="btn-submit" onClick={handleStatusUpdate}>Save Status</button>
        <button className="btn-edit-visit" onClick={() => setEditMode(true)}>
          Edit Visit
        </button>
        <button className="btn-cancel" onClick={handleDelete} style={{ color: '#f14e4b' }}>
          Delete Visit
        </button>
      </div>
    </Modal>
  );
}

export default VisitDetailModal;
