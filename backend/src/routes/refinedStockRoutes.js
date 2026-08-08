const express = require('express');
const router = express.Router();
const { getEntries, createEntry } = require('../controllers/refinedStockController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getEntries);
router.post('/', protect, authorize('admin', 'manager'), createEntry);

module.exports = router;
