const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getPurchases,
  getPurchase,
  createPurchase,
  deletePurchase,
  getPurchaseSummary,
} = require('../controllers/purchaseController');

// Purchase list & summary (summary must be registered before /:id)
router.get('/', protect, getPurchases);
router.get('/summary', protect, getPurchaseSummary);
router.post('/', protect, authorize('admin', 'manager'), createPurchase);
router.get('/:id', protect, getPurchase);
router.delete('/:id', protect, authorize('admin'), deletePurchase);

module.exports = router;
