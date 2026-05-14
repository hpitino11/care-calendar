const express = require('express');
const router = express.Router();
const { getAllCaregivers, createCaregiver, updateCaregiver, deleteCaregiver } = require('../controllers/caregiverController');

router.get('/', getAllCaregivers);
router.post('/', createCaregiver);
router.put('/:id', updateCaregiver);
router.delete('/:id', deleteCaregiver);

module.exports = router;
