const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getItems, getItem, createItem, updateItem, deleteItem, getItemByBarcode, getItemByQrToken, regenerateItemQrToken, getLowStock, bulkCreateItems, cloneItem, bulkUpdateItems, bulkDeleteItems, getDashboardItemStats } = require('../controllers/itemController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { uploadImages, uploadSingleImage } = require('../middleware/upload');

const itemValidation = [
  body('itemName').trim().notEmpty().withMessage('Item name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('grossWeight').isFloat({ min: 0 }).withMessage('Gross weight must be a positive number'),
  body('metalType').isIn(['gold', 'silver', 'diamond', 'gemstone']).withMessage('Metal type must be gold, silver, diamond, or gemstone'),
  body('purity').isFloat({ min: 0, max: 1000 }).withMessage('Purity must be between 0 and 1000'),
]

const updateValidation = [
  body('itemName').optional().trim().notEmpty().withMessage('Item name cannot be empty'),
  body('grossWeight').optional().isFloat({ min: 0 }).withMessage('Gross weight must be a positive number'),
  body('metalType').optional().isIn(['gold', 'silver', 'diamond', 'gemstone']).withMessage('Metal type must be gold, silver, diamond, or gemstone'),
  body('purity').optional().isFloat({ min: 0, max: 1000 }).withMessage('Purity must be between 0 and 1000'),
  body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a non-negative integer'),
  body('status').optional().isIn(['In Stock', 'Sold', 'With Karigar', 'Pawn Collateral', 'On Approval', 'Branch Transfer', 'Damaged', 'Melted']).withMessage('Invalid status value'),
]

router.get('/', protect, getItems);
router.get('/stats', protect, getDashboardItemStats);
router.get('/low-stock', protect, getLowStock);
router.get('/barcode/:barcode', protect, getItemByBarcode);
router.get('/lookup/:qrToken', protect, authorize('staff', 'manager', 'admin', 'qr_lookup'), getItemByQrToken);
router.get('/:id', protect, getItem);
router.post('/', protect, authorize('admin', 'manager'), uploadImages, itemValidation, validate, createItem);
router.post('/bulk', protect, authorize('admin', 'manager'), bulkCreateItems);
router.post('/bulk-update', protect, authorize('admin', 'manager'), bulkUpdateItems);
router.post('/bulk-delete', protect, authorize('admin'), bulkDeleteItems);
router.post('/:id/clone', protect, authorize('admin', 'manager'), cloneItem);
router.post('/:id/regenerate-qr', protect, authorize('admin', 'manager'), regenerateItemQrToken);
router.put('/:id', protect, authorize('admin', 'manager'), uploadImages, updateValidation, validate, updateItem);
router.delete('/:id', protect, authorize('admin'), deleteItem);

module.exports = router;
