const express = require('express');
const router = express.Router();
const { createSale, getSales, getSale, deleteSale, createCombinedSale, getDiamondVatStatus } = require('../controllers/posController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getSales);
router.get('/diamond-vat-status', protect, getDiamondVatStatus);
router.get('/:id', protect, getSale);
router.post('/', protect, authorize('admin', 'manager'), createSale);
router.post('/checkout', protect, authorize('admin', 'manager'), createCombinedSale);
router.delete('/:id', protect, authorize('admin'), deleteSale);

module.exports = router;
