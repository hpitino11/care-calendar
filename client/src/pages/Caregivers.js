import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import BASE_URL from '../api';
import './Caregivers.css';

function Caregivers() {
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [editingCaregiver, setEditingCaregiver] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });

  const fetchCaregivers = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/caregivers`);
      const data = await res.json();
      setCaregivers(data);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaregivers();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BASE_URL}/api/caregivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setFormData({ name: '', email: '', phone: '' });
      setShowModal(false);
      fetchCaregivers();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this caregiver?')) return;
    try {
      await fetch(`${BASE_URL}/api/caregivers/${id}`, { method: 'DELETE' });
      fetchCaregivers();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const handleEditClick = (caregiver) => {
    setEditingCaregiver(caregiver);
    setEditForm({ name: caregiver.name, email: caregiver.email || '', phone: caregiver.phone || '' });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BASE_URL}/api/caregivers/${editingCaregiver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditingCaregiver(null);
      fetchCaregivers();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const filtered = caregivers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p className="state-loading">Loading...</p>;
  if (error)   return <p className="state-error">Something went wrong.</p>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Caregivers</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          Add Caregiver
        </button>
      </div>

      <input
        type="text"
        placeholder="Search caregivers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
      />

      {filtered.length === 0 ? (
        <p className="state-empty">No caregivers found.</p>
      ) : (
        <div className="card-grid">
          {filtered.map((cg) => (
            <div key={cg.id} className="caregiver-card">
              <div className="caregiver-avatar">
                {cg.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="caregiver-name">{cg.name}</h2>
              {cg.email && (
                <p className="caregiver-detail">✉ {cg.email}</p>
              )}
              {cg.phone && (
                <p className="caregiver-detail">📞 {cg.phone}</p>
              )}
              <button className="card-edit" onClick={() => handleEditClick(cg)}>
                Edit
              </button>
              <button className="btn-delete" onClick={() => handleDelete(cg.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 className="modal-title">Add Caregiver</h2>
          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label>Name *</label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="Full name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="email@example.com"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="(555) 000-0000"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-submit">Add Caregiver</button>
              <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editingCaregiver && (
        <Modal onClose={() => setEditingCaregiver(null)}>
          <h2 className="modal-title">Edit Caregiver</h2>
          <form onSubmit={handleEditSubmit} className="form">
            <div className="form-group">
              <label>Name *</label>
              <input
                name="name"
                value={editForm.name}
                onChange={handleEditChange}
                required
                placeholder="Full name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                name="email"
                type="email"
                value={editForm.email}
                onChange={handleEditChange}
                placeholder="email@example.com"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                name="phone"
                value={editForm.phone}
                onChange={handleEditChange}
                placeholder="(555) 000-0000"
              />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-submit">Save Changes</button>
              <button type="button" className="btn-cancel" onClick={() => setEditingCaregiver(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Caregivers;
