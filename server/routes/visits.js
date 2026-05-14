const express = require('express');
const router = express.Router();
const { getAllVisits, createVisit, updateVisit, updateVisitStatus, deleteVisit } = require('../controllers/visitController');

router.get('/', getAllVisits);
router.post('/', createVisit);
router.put('/:id/status', updateVisitStatus);
router.put('/:id', updateVisit);
router.delete('/:id', deleteVisit);

module.exports = router;
