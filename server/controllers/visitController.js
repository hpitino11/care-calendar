const pool = require('../db/pool');

// Returns any visits for the same caregiver whose date+time ranges overlap with the given window.
// excludeId lets update calls skip the visit being edited.
async function checkCaregiverConflict(caregiver_id, visit_date, end_date, start_time, end_time, excludeId = null) {
  const query = `
    SELECT id FROM visits
    WHERE caregiver_id = $1
      AND visit_date                    <= $2
      AND COALESCE(end_date, visit_date) >= $3
      AND start_time  <  $4
      AND end_time    >  $5
      ${excludeId ? 'AND id != $6' : ''}
  `;
  const params = [caregiver_id, end_date, visit_date, end_time, start_time];
  if (excludeId) params.push(excludeId);
  const result = await pool.query(query, params);
  return result.rows.length > 0;
}

// Marks any scheduled visit as completed once today is past its end date.
// Runs before every GET /api/visits so statuses are always up to date.
async function autoCompleteVisits() {
  await pool.query(`
    UPDATE visits
    SET status = 'completed'
    WHERE status = 'scheduled'
      AND COALESCE(end_date, visit_date) < CURRENT_DATE
  `);
}

const getAllVisits = async (req, res, next) => {
  try {
    await autoCompleteVisits();

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

  const resolvedEndDate = end_date || visit_date;

  try {
    const hasConflict = await checkCaregiverConflict(caregiver_id, visit_date, resolvedEndDate, start_time, end_time);
    if (hasConflict) {
      return res.status(409).json({ message: 'This caregiver is already scheduled during that time. Please choose a different time or caregiver.' });
    }

    const result = await pool.query(
      `INSERT INTO visits (caregiver_id, client_id, visit_date, end_date, start_time, end_time, status, notes, service_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [caregiver_id, client_id, visit_date, resolvedEndDate, start_time, end_time, status || 'scheduled', notes || null, service_type || null]
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

  const resolvedEndDate = end_date || visit_date;

  try {
    const hasConflict = await checkCaregiverConflict(caregiver_id, visit_date, resolvedEndDate, start_time, end_time, id);
    if (hasConflict) {
      return res.status(409).json({ message: 'This caregiver is already scheduled during that time. Please choose a different time or caregiver.' });
    }

    const result = await pool.query(
      `UPDATE visits
       SET caregiver_id = $1, client_id = $2, visit_date = $3, end_date = $4,
           start_time = $5, end_time = $6, status = $7, notes = $8, service_type = $9
       WHERE id = $10
       RETURNING *`,
      [caregiver_id, client_id, visit_date, resolvedEndDate, start_time, end_time, status, notes || null, service_type || null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Visit not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// Returns the booked start/end times for a caregiver on a specific date.
// Used by the frontend to grey out unavailable time slots in the form.
const getCaregiverSlots = async (req, res, next) => {
  const { caregiver_id, date } = req.query;
  if (!caregiver_id || !date) return res.json([]);
  try {
    const result = await pool.query(
      `SELECT start_time, end_time FROM visits
       WHERE caregiver_id = $1
         AND visit_date                     <= $2
         AND COALESCE(end_date, visit_date) >= $2`,
      [caregiver_id, date]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllVisits, createVisit, updateVisit, updateVisitStatus, deleteVisit, getCaregiverSlots };
