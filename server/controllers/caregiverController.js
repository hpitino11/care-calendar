const pool = require('../db/pool');

const getAllCaregivers = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM caregivers ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const createCaregiver = async (req, res, next) => {
  const { name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO caregivers (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteCaregiver = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM caregivers WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Caregiver not found' });
    }
    res.json({ message: 'Caregiver deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllCaregivers, createCaregiver, deleteCaregiver };
