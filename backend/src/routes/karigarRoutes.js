const express = require('express');
const router = express.Router();
const { getKarigars, getKarigar, createKarigar, updateKarigar, deleteKarigar, issueMaterial, receiveFinished, getPendingJobs, getKarigarReport, updateMaterialStatus } = require('../controllers/karigarController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getKarigars);
router.get('/pending-jobs', protect, getPendingJobs);
router.get('/:id', protect, getKarigar);
router.get('/:id/report', protect, authorize('admin', 'manager'), getKarigarReport);
router.post('/', protect, authorize('admin', 'manager'), createKarigar);
router.post('/:id/issue', protect, authorize('admin', 'manager'), issueMaterial);
router.post('/:id/receive', protect, authorize('admin', 'manager'), receiveFinished);
router.patch('/:id/materials/:materialIndex', protect, authorize('admin', 'manager'), updateMaterialStatus);
router.put('/:id', protect, authorize('admin', 'manager'), updateKarigar);
router.delete('/:id', protect, authorize('admin'), deleteKarigar);

module.exports = router;
