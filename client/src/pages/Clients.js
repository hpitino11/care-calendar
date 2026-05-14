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

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p className="state-loading">Loading...</p>;
  if (error)   return <p className="state-error">Something went wrong.</p>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clients</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          Add Client
        </button>
      </div>

      <input
        type="text"
        placeholder="Search clients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
      />

      {filtered.length === 0 ? (
        <p className="state-empty">No clients found.</p>
      ) : (
        <div className="card-grid">
          {filtered.map((cl) => (
            <div key={cl.id} className="caregiver-card">
              <div className="caregiver-avatar">
                {cl.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="caregiver-name">{cl.name}</h2>
              {cl.email && (
                <p className="caregiver-detail">✉ {cl.email}</p>
              )}
              {cl.phone && (
                <p className="caregiver-detail">📞 {cl.phone}</p>
              )}
              <button
                className="btn-delete"
                onClick={() => handleDelete(cl.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

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
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowModal(false)}
              >
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
