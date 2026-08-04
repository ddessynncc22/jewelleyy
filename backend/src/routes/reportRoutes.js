const express = require('express');
const router = express.Router();
const { getCurrentStock, getStockMovement, getInventoryValuation, getPawnReport, getKarigarReport, getCustomerLedgerReport, getCustomerLedgerStatement, getProfitSummary, getTaxReport, exportReport } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.get('/current-stock', protect, getCurrentStock);
router.get('/stock-movement', protect, getStockMovement);
router.get('/inventory-valuation', protect, getInventoryValuation);
router.get('/pawn', protect, authorize('admin', 'manager'), getPawnReport);
router.get('/karigar', protect, authorize('admin', 'manager'), getKarigarReport);
router.get('/customer-ledger', protect, authorize('admin', 'manager'), getCustomerLedgerReport);
router.get('/customer-ledger/:customerId/statement', protect, authorize('admin', 'manager'), getCustomerLedgerStatement);
router.get('/profit-summary', protect, authorize('admin', 'manager'), getProfitSummary);
router.get('/tax', protect, authorize('admin', 'manager'), getTaxReport);
router.get('/export/:type', protect, authorize('admin'), exportReport);

module.exports = router;
