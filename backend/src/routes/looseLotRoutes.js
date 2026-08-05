const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  listLots,
  getLot,
  getLotByBarcode,
  createLot,
  updateLot,
  deleteLot,
  sellLots,
  createLooseBill,
  getLooseBill,
  getLowStock,
  getStockReport,
  getStockSummary,
  getDayEndReport,
} = require('../controllers/looseLotController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const lotValidation = [
  body('totalGrossWeight').isFloat({ min: 0.0001 }).withMessage('Total gross weight must be greater than 0'),
  body('totalPieces').isInt({ min: 1 }).withMessage('Total pieces must be at least 1'),
  body('metalType').optional().isIn(['gold', 'silver', 'diamond', 'gemstone']).withMessage('Invalid metal type'),
  body('purity').optional().isFloat({ min: 0, max: 1000 }).withMessage('Purity must be between 0 and 1000'),
  body('makingChargeValue').optional().isFloat({ min: 0 }).withMessage('Making charge must be non-negative'),
  body('makingChargeType').optional().isIn(['per_piece', 'per_gram', 'percentage', 'none']).withMessage('Invalid making charge type'),
];

const sellLineValidation = [
  body('lines').optional().isArray().withMessage('lines must be an array'),
  body('lotId').if(body('lines').not().exists()).notEmpty().withMessage('lotId is required'),
  body('lines.*.lotId').optional().notEmpty().withMessage('lotId is required for each line'),
  body('lines.*.piecesSold').optional().isInt({ min: 1 }).withMessage('piecesSold must be a positive integer'),
  body('lines.*.actualWeightSold').optional().isFloat({ min: 0.0001 }).withMessage('actualWeightSold must be greater than 0'),
  body('lines.*.weightSource').optional().isIn(['average', 'manual_weighed']).withMessage('Invalid weight source'),
  body('lines.*.managerApproved').optional().isBoolean().withMessage('managerApproved must be boolean'),
];

router.get('/', protect, listLots);
router.get('/reports/stock', protect, getStockReport);
router.get('/reports/summary', protect, getStockSummary);
router.get('/reports/day-end', protect, getDayEndReport);
router.get('/low-stock', protect, getLowStock);
router.get('/barcode/:barcode', protect, getLotByBarcode);
router.get('/bill/:id', protect, getLooseBill);
router.get('/:id', protect, getLot);
router.post('/', protect, authorize('admin', 'manager'), lotValidation, validate, createLot);
router.post('/sell', protect, authorize('admin', 'manager'), sellLineValidation, validate, sellLots);
router.post('/bill', protect, authorize('admin', 'manager'), createLooseBill);
router.put('/:id', protect, authorize('admin', 'manager'), updateLot);
router.delete('/:id', protect, authorize('admin'), deleteLot);

module.exports = router;
