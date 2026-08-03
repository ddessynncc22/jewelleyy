const express = require('express');
const router = express.Router();
const { getPawnLoans, getPawnLoan, createPawnLoan, updatePawnLoan, deletePawnLoan, makePayment, addPrincipalTranche, renewLoan, forfeitLoan, redeemLoan, getPawnReport } = require('../controllers/pawnController');
const { protect, authorize } = require('../middleware/auth');
const { uploadImages } = require('../middleware/upload');

router.get('/', protect, getPawnLoans);
router.get('/report', protect, authorize('admin', 'manager'), getPawnReport);
router.get('/:id', protect, getPawnLoan);
router.post('/', protect, authorize('admin', 'manager'), uploadImages, createPawnLoan);
router.post('/:id/payment', protect, authorize('admin', 'manager'), makePayment);
router.post('/:id/principal', protect, authorize('admin', 'manager'), addPrincipalTranche);
router.post('/:id/renew', protect, authorize('admin', 'manager'), renewLoan);
router.post('/:id/forfeit', protect, authorize('admin'), forfeitLoan);
router.post('/:id/redeem', protect, authorize('admin', 'manager'), redeemLoan);
router.put('/:id', protect, authorize('admin', 'manager'), uploadImages, updatePawnLoan);
router.delete('/:id', protect, authorize('admin'), deletePawnLoan);

module.exports = router;
