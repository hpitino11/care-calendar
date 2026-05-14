import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import BASE_URL from '../api';

const VALID_STATUSES = ['scheduled', 'completed', 'cancelled'];

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

function formatFullDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function VisitDetailModal({ visit, onClose, onSuccess }) {
  const [status, setStatus] = useState(visit.status);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [caregivers, setCaregivers] = useState([]);
  const [clients, setClients] = useState([]);

  // Prefill form and detect multi-day when edit mode opens
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
      start_time: visit.start_time ? visit.start_time.slice(0, 5) : '',
      end_time: visit.end_time ? visit.end_time.slice(0, 5) : '',
      status: visit.status || 'scheduled',
      notes: visit.notes || '',
      service_type: visit.service_type || '',
    });
  }, [editMode, visit]);

  // Fetch caregiver and client dropdowns when edit mode opens
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
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BASE_URL}/api/visits/${visit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          end_date: editForm.end_date || editForm.visit_date,
        }),
      });
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
          <div className="form-group">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={isMultiDay}
                onChange={(e) => {
                  setIsMultiDay(e.target.checked);
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
                onChange={handleEditChange}
                min={editForm.visit_date}
              />
            </div>
          )}
          <div className="form-group">
            <label>Start Time *</label>
            <select name="start_time" value={editForm.start_time} onChange={handleEditChange} required>
              <option value="">Select start time</option>
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>End Time *</label>
            <select name="end_time" value={editForm.end_time} onChange={handleEditChange} required>
              <option value="">Select end time</option>
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
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
        {visit.notes && <p><span className="detail-label">Notes</span> {visit.notes}</p>}
      </div>

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
