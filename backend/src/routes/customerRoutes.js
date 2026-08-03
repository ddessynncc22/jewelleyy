const express = require('express');
const router = express.Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerLedger, addLedgerEntry, getCustomerReport } = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getCustomers);
router.get('/:id', protect, getCustomer);
router.get('/:id/ledger', protect, getCustomerLedger);
router.get('/:id/report', protect, authorize('admin', 'manager'), getCustomerReport);
router.post('/', protect, authorize('admin', 'manager'), createCustomer);
router.post('/:id/ledger', protect, authorize('admin', 'manager'), addLedgerEntry);
router.put('/:id', protect, authorize('admin', 'manager'), updateCustomer);
router.delete('/:id', protect, authorize('admin'), deleteCustomer);

module.exports = router;
