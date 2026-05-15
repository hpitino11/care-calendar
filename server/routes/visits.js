const express = require('express');
const router = express.Router();
const { getAllVisits, createVisit, updateVisit, updateVisitStatus, deleteVisit, getCaregiverSlots } = require('../controllers/visitController');

router.get('/caregiver-slots', getCaregiverSlots);
router.get('/', getAllVisits);
router.post('/', createVisit);
router.put('/:id/status', updateVisitStatus);
router.put('/:id', updateVisit);
router.delete('/:id', deleteVisit);

module.exports = router;
