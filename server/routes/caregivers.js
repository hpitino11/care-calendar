const express = require('express');
const router = express.Router();
const { getAllCaregivers, createCaregiver, deleteCaregiver } = require('../controllers/caregiverController');

router.get('/', getAllCaregivers);
router.post('/', createCaregiver);
router.delete('/:id', deleteCaregiver);

module.exports = router;
