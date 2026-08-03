const express = require('express');
const router = express.Router();
const { getRates, getLatestRates, createRate, updateRate, deleteRate } = require('../controllers/rateController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getRates);
router.get('/latest', getLatestRates);
router.post('/', protect, authorize('admin', 'manager'), createRate);
router.put('/:id', protect, authorize('admin', 'manager'), updateRate);
router.delete('/:id', protect, authorize('admin'), deleteRate);

module.exports = router;
