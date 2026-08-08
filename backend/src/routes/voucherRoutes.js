const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const {
  getLedgers,
  getLedger,
  createLedger,
  updateLedger,
  deleteLedger,
  createVoucher,
  getVouchers,
  getVoucher,
  updateVoucher,
  deleteVoucher,
  getVoucherReport,
  getVoucherDetailsReport,
  getDayBook,
  getLedgerReport,
  getSundryDebtors,
  getSundryCreditors,
} = require('../controllers/voucherController');
const { protect, authorize } = require('../middleware/auth');

const LEDGER_TYPES = ['cash', 'bank', 'debtor', 'creditor', 'stock', 'income', 'expense'];
const VOUCHER_TYPES = ['payment', 'receipt', 'contra', 'journal', 'metal_to_cash'];

const ledgerValidation = [
  body('name').trim().notEmpty().withMessage('Ledger name is required'),
  body('type').isIn(LEDGER_TYPES).withMessage(`Type must be one of: ${LEDGER_TYPES.join(', ')}`),
  body('partyType').optional().isIn(['customer', 'supplier', 'none']).withMessage('Invalid party type'),
  body('partyId').optional().isMongoId().withMessage('Invalid party id'),
  body('openingBalance').optional().isFloat({ min: 0 }).withMessage('Opening balance must be non-negative'),
];

const voucherValidation = [
  body('type').isIn(VOUCHER_TYPES).withMessage(`Type must be one of: ${VOUCHER_TYPES.join(', ')}`),
  body('entries').isArray({ min: 2 }).withMessage('At least two line entries are required'),
  body('entries.*.ledger').isMongoId().withMessage('Each entry needs a valid ledger id'),
  body('entries.*.debit').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Debit must be a non-negative number'),
  body('entries.*.credit').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Credit must be a non-negative number'),
  body('entries.*.narration').optional().isString().withMessage('Entry narration must be a string'),
  body('metalDetails').if(body('type').equals('metal_to_cash')).isArray({ min: 1 }).withMessage('Metal details are required for Metal to Cash vouchers'),
  body('metalDetails.*.metalType').optional().isIn(['gold', 'silver']).withMessage('Metal type must be gold or silver'),
];

// --- Ledger routes (specific paths declared before /:id so "debtors"/"creditors" are not captured) ---
router.get('/ledgers', protect, getLedgers);
router.get('/ledgers/debtors', protect, authorize('admin', 'manager'), getSundryDebtors);
router.get('/ledgers/creditors', protect, authorize('admin', 'manager'), getSundryCreditors);
router.get('/ledgers/:id/report', protect, authorize('admin', 'manager'), getLedgerReport);
router.get('/ledgers/:id', protect, getLedger);
router.post('/ledgers', protect, authorize('admin', 'manager'), ledgerValidation, validate, createLedger);
router.put('/ledgers/:id', protect, authorize('admin', 'manager'), updateLedger);
router.delete('/ledgers/:id', protect, authorize('admin', 'manager'), deleteLedger);

// --- Vouchers (report/day-book declared before :id) ---
router.get('/vouchers/reports/day-book', protect, authorize('admin', 'manager'), getDayBook);
router.get('/vouchers/report', protect, authorize('admin', 'manager'), getVoucherReport);
router.get('/vouchers', protect, getVouchers);
router.post('/vouchers', protect, authorize('admin', 'manager'), voucherValidation, validate, createVoucher);
router.get('/vouchers/:id', protect, getVoucher);
router.get('/vouchers/:id/report', protect, authorize('admin', 'manager'), getVoucherDetailsReport);
router.put('/vouchers/:id', protect, authorize('admin', 'manager'), voucherValidation, validate, updateVoucher);
router.delete('/vouchers/:id', protect, authorize('admin', 'manager'), deleteVoucher);

module.exports = router;