const pool = require('../db/pool');

const getAllClients = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const createClient = async (req, res, next) => {
  const { name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO clients (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const updateClient = async (req, res, next) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE clients SET name = $1, email = $2, phone = $3 WHERE id = $4 RETURNING *',
      [name, email, phone, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteClient = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM clients WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }
    res.json({ message: 'Client deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllClients, createClient, updateClient, deleteClient };
