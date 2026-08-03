const express = require('express');
const router = express.Router();
const {
  getCustomOrders,
  getCustomOrder,
  createCustomOrder,
  addAdvance,
  updateOrderStatus,
  deleteCustomOrder,
} = require('../controllers/customOrderController');
const { protect, authorize } = require('../middleware/auth');
const { uploadImages } = require('../middleware/upload');

router.get('/', protect, getCustomOrders);
router.get('/:id', protect, getCustomOrder);
router.post('/', protect, authorize('admin', 'manager'), uploadImages, createCustomOrder);
router.post('/:id/advance', protect, authorize('admin', 'manager'), addAdvance);
router.post('/:id/status', protect, authorize('admin', 'manager'), updateOrderStatus);
router.delete('/:id', protect, authorize('admin'), deleteCustomOrder);

module.exports = router;
