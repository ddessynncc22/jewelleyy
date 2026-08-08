const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getRefines,
  createRefine,
  receiveRefine,
  deleteRefine,
  getRefineCandidates,
} = require('../controllers/refineController');

router.get('/', protect, getRefines);
router.get('/candidates', protect, getRefineCandidates);
router.post('/', protect, authorize('admin', 'manager'), createRefine);
router.post('/:id/receive', protect, authorize('admin', 'manager'), receiveRefine);
router.delete('/:id', protect, authorize('admin'), deleteRefine);

module.exports = router;
