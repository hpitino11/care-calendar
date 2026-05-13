const express = require('express');
const router = express.Router();
const { getAllVisits, createVisit, updateVisitStatus, deleteVisit } = require('../controllers/visitController');

router.get('/', getAllVisits);
router.post('/', createVisit);
router.put('/:id/status', updateVisitStatus);
router.delete('/:id', deleteVisit);

module.exports = router;
