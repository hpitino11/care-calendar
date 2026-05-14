const pool = require('../db/pool');

const getAllVisits = async (req, res, next) => {
  try {
    // Join caregivers and clients so the response includes names, not just IDs
    const result = await pool.query(`
      SELECT
        v.id,
        v.visit_date,
        v.end_date,
        v.start_time,
        v.end_time,
        v.status,
        v.notes,
        v.service_type,
        v.created_at,
        v.caregiver_id,
        v.client_id,
        cg.name AS caregiver_name,
        cl.name AS client_name
      FROM visits v
      LEFT JOIN caregivers cg ON v.caregiver_id = cg.id
      LEFT JOIN clients cl ON v.client_id = cl.id
      ORDER BY v.visit_date ASC, v.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const createVisit = async (req, res, next) => {
  const { caregiver_id, client_id, visit_date, end_date, start_time, end_time, status, notes, service_type } = req.body;

  if (!caregiver_id || !client_id || !visit_date || !start_time || !end_time) {
    return res.status(400).json({
      message: 'caregiver_id, client_id, visit_date, start_time, and end_time are all required',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO visits (caregiver_id, client_id, visit_date, end_date, start_time, end_time, status, notes, service_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [caregiver_id, client_id, visit_date, end_date || visit_date, start_time, end_time, status || 'scheduled', notes || null, service_type || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const VALID_STATUSES = ['scheduled', 'completed', 'cancelled'];

const updateVisitStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'status must be scheduled, completed, or cancelled' });
  }

  try {
    const result = await pool.query(
      'UPDATE visits SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const deleteVisit = async (req, res, next) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM visits WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    res.json({ message: 'Visit deleted' });
  } catch (err) {
    next(err);
  }
};

const updateVisit = async (req, res, next) => {
  const { id } = req.params;
  const { caregiver_id, client_id, visit_date, end_date, start_time, end_time, status, notes, service_type } = req.body;

  try {
    const result = await pool.query(
      `UPDATE visits
       SET caregiver_id = $1, client_id = $2, visit_date = $3, end_date = $4,
           start_time = $5, end_time = $6, status = $7, notes = $8, service_type = $9
       WHERE id = $10
       RETURNING *`,
      [caregiver_id, client_id, visit_date, end_date || visit_date, start_time, end_time, status, notes || null, service_type || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllVisits, createVisit, updateVisit, updateVisitStatus, deleteVisit };
