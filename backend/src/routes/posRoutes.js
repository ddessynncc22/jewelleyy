const express = require('express');
const router = express.Router();
const { createSale, getSales, getSale, deleteSale } = require('../controllers/posController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getSales);
router.get('/:id', protect, getSale);
router.post('/', protect, authorize('admin', 'manager'), createSale);
router.delete('/:id', protect, authorize('admin'), deleteSale);

module.exports = router;
