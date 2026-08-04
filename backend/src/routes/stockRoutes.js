const express = require('express');
const router = express.Router();
const { getStockMovements, getStockStats, createStockIn, createStockOut, getStockHistory, getStockSummary } = require('../controllers/stockController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getStockMovements);
router.get('/summary', protect, getStockSummary);
router.get('/stats', protect, getStockStats);
router.get('/:itemId/history', protect, getStockHistory);
router.post('/in', protect, authorize('admin', 'manager'), createStockIn);
router.post('/out', protect, authorize('admin', 'manager'), createStockOut);

module.exports = router;
