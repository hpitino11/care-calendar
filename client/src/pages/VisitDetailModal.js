import { useState } from 'react';
import Modal from '../components/Modal';
import BASE_URL from '../api';

const VALID_STATUSES = ['scheduled', 'completed', 'cancelled'];

function VisitDetailModal({ visit, onClose, onSuccess }) {
  const [status, setStatus] = useState(visit.status);

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

  return (
    <Modal onClose={onClose}>
      <h2 className="modal-title">Visit Details</h2>
      <div className="visit-detail">
        <p><span className="detail-label">Caregiver</span> {visit.caregiver_name || '—'}</p>
        <p><span className="detail-label">Client</span> {visit.client_name || '—'}</p>
        <p><span className="detail-label">Date</span> {visit.visit_date?.slice(0, 10)}</p>
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
        <button className="btn-cancel" onClick={handleDelete} style={{ color: '#f14e4b' }}>
          Delete Visit
        </button>
      </div>
    </Modal>
  );
}

export default VisitDetailModal;
