import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import BASE_URL from '../api';

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

// Generates time options in 15-minute increments from 6:00 AM to 10:00 PM.
// Returns an array of { value: "HH:MM", label: "H:MM AM/PM" } objects.
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

// Pre-built at module level so it isn't recalculated on every render
const TIME_OPTIONS = generateTimeOptions();

// True if `time` falls inside any booked slot (caregiver is already working then)
function isStartBlocked(time, bookedSlots) {
  return bookedSlots.some(({ start_time, end_time }) => {
    const s = start_time.slice(0, 5);
    const e = end_time.slice(0, 5);
    return time >= s && time < e;
  });
}

// True if choosing `time` as the end would overlap with any booked slot
function isEndBlocked(time, startTime, bookedSlots) {
  if (!startTime) return false;
  return bookedSlots.some(({ start_time, end_time }) => {
    const bs = start_time.slice(0, 5);
    const be = end_time.slice(0, 5);
    return startTime < be && time > bs;
  });
}

function AddVisitModal({ onClose, onSuccess, prefillDate }) {
  // ── State ──
  const [caregivers, setCaregivers] = useState([]);
  const [clients, setClients] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isMultiDay, setIsMultiDay] = useState(false); // toggles end date field visibility
  const [dateError, setDateError] = useState('');
  const [conflictError, setConflictError] = useState('');
  const [formData, setFormData] = useState({
    caregiver_id: '',
    client_id: '',
    visit_date: prefillDate || '', // pre-filled when clicking a date on the calendar
    end_date: '',
    start_time: '',
    end_time: '',
    notes: '',
    service_type: '',
  });

  // ── Load dropdown data ──
  // Fetch caregivers and clients in parallel when the modal first opens
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

  // ── Fetch booked slots for the selected caregiver + date ──
  useEffect(() => {
    if (!formData.caregiver_id || !formData.visit_date) {
      setBookedSlots([]);
      return;
    }
    const fetchSlots = async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/visits/caregiver-slots?caregiver_id=${formData.caregiver_id}&date=${formData.visit_date}`
        );
        setBookedSlots(await res.json());
      } catch (err) {
        console.error('Failed to load caregiver availability', err);
      }
    };
    fetchSlots();
  }, [formData.caregiver_id, formData.visit_date]);

  // ── Form handlers ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    // Clear time selections when caregiver or date changes — booked slots will differ
    if (name === 'caregiver_id' || name === 'visit_date') {
      updated.start_time = '';
      updated.end_time = '';
    }
    // Clear end_time if it's no longer after the new start_time
    if (name === 'start_time' && formData.end_time && formData.end_time <= value) {
      updated.end_time = '';
    }
    setFormData(updated);
    if (name === 'end_date') setDateError('');
    setConflictError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate the end date before submitting a multi-day visit
    if (isMultiDay && !formData.end_date) {
      setDateError('Please select an end date.');
      return;
    }

    if (isMultiDay && formData.end_date < formData.visit_date) {
      setDateError('End date must be after start date.');
      return;
    }

    // Only include end_date in the request body when scheduling a multi-day visit
    const body = { ...formData };
    if (!isMultiDay) delete body.end_date;

    try {
      const res = await fetch(`${BASE_URL}/api/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  return (
    <Modal onClose={onClose}>
      <h2 className="modal-title">Schedule Visit</h2>
      <form onSubmit={handleSubmit} className="form">

        {/* Caregiver and client selects are populated from the API */}
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
          <label>Service Type</label>
          <select name="service_type" value={formData.service_type} onChange={handleChange}>
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
            value={formData.visit_date}
            onChange={handleChange}
            required
          />
        </div>

        {/* Multi-day toggle — checking this reveals the end date field */}
        <div className="form-group">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={isMultiDay}
              onChange={(e) => {
                setIsMultiDay(e.target.checked);
                // Clear end date and any error when toggling off
                if (!e.target.checked) {
                  setFormData({ ...formData, end_date: '' });
                  setDateError('');
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
              value={formData.end_date}
              onChange={handleChange}
              min={formData.visit_date} // prevents selecting an end date before the start
            />
            {dateError && <p className="field-error">{dateError}</p>}
          </div>
        )}

        {/* Time selects use pre-generated 15-minute increment options */}
        <div className="form-group">
          <label>Start Time *</label>
          <select name="start_time" value={formData.start_time} onChange={handleChange} required>
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
          <select name="end_time" value={formData.end_time} onChange={handleChange} required>
            <option value="">Select end time</option>
            {TIME_OPTIONS
              .filter((opt) => !formData.start_time || opt.value > formData.start_time)
              .map((opt) => {
                const blocked = isEndBlocked(opt.value, formData.start_time, bookedSlots);
                return (
                  <option key={opt.value} value={opt.value} disabled={blocked}>
                    {opt.label}{blocked ? ' — conflict' : ''}
                  </option>
                );
              })}
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

        {conflictError && <p className="form-conflict-error">{conflictError}</p>}

        <div className="form-actions">
          <button type="submit" className="btn-submit">Schedule Visit</button>
          <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export default AddVisitModal;
