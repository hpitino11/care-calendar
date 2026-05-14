import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import BASE_URL from '../api';

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

function AddVisitModal({ onClose, onSuccess, prefillDate }) {
  const [caregivers, setCaregivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({
    caregiver_id: '',
    client_id: '',
    visit_date: prefillDate || '',
    start_time: '',
    end_time: '',
    notes: '',
  });

  // Load dropdowns when the modal opens
  useEffect(() => {
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
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BASE_URL}/api/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="modal-title">Schedule Visit</h2>
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label>Caregiver *</label>
          <select name="caregiver_id" value={formData.caregiver_id} onChange={handleChange} required>
            <option value="">Select caregiver</option>
            {caregivers.map((cg) => (
              <option key={cg.id} value={cg.id}>{cg.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Client *</label>
          <select name="client_id" value={formData.client_id} onChange={handleChange} required>
            <option value="">Select client</option>
            {clients.map((cl) => (
              <option key={cl.id} value={cl.id}>{cl.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Date *</label>
          <input
            type="date"
            name="visit_date"
            value={formData.visit_date}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Start Time *</label>
          <select name="start_time" value={formData.start_time} onChange={handleChange} required>
            <option value="">Select start time</option>
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>End Time *</label>
          <select name="end_time" value={formData.end_time} onChange={handleChange} required>
            <option value="">Select end time</option>
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Notes</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Optional notes..."
            rows={3}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-submit">Schedule Visit</button>
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export default AddVisitModal;
