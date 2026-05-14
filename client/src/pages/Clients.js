import { useState, useEffect } from 'react';
import Modal from '../components/Modal';
import BASE_URL from '../api';
import './Clients.css';

function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });
  const [editingClient, setEditingClient] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });

  const fetchClients = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/clients`);
      const data = await res.json();
      setClients(data);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BASE_URL}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setFormData({ name: '', email: '', phone: '' });
      setShowModal(false);
      fetchClients();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this client?')) return;
    try {
      await fetch(`${BASE_URL}/api/clients/${id}`, { method: 'DELETE' });
      fetchClients();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const handleEditClick = (client) => {
    setEditingClient(client);
    setEditForm({ name: client.name, email: client.email || '', phone: client.phone || '' });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BASE_URL}/api/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditingClient(null);
      fetchClients();
    } catch (err) {
      alert('Something went wrong. Please try again.');
    }
  };

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p className="state-loading">Loading...</p>;
  if (error)   return <p className="state-error">Something went wrong.</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your clients</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Client
        </button>
      </div>

      <div className="search-wrap">
        <svg className="search-icon-inline" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="state-empty">No clients found.</p>
      ) : (
        <div className="caregiver-list">
          {filtered.map((cl) => (
            <div key={cl.id} className="caregiver-card">
              <div className="caregiver-avatar">
                {cl.name.charAt(0).toUpperCase()}
              </div>
              <div className="caregiver-info">
                <h2 className="caregiver-name">{cl.name}</h2>
                {cl.email && (
                  <p className="caregiver-detail">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    {cl.email}
                  </p>
                )}
                {cl.phone && (
                  <p className="caregiver-detail">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    {cl.phone}
                  </p>
                )}
                <div className="caregiver-actions">
                  <button className="card-edit" onClick={() => handleEditClick(cl)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(cl.id)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h2 className="modal-title">Add Client</h2>
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
              <button type="submit" className="btn-submit">Add Client</button>
              <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editingClient && (
        <Modal onClose={() => setEditingClient(null)}>
          <h2 className="modal-title">Edit Client</h2>
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
              <button type="button" className="btn-cancel" onClick={() => setEditingClient(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Clients;
