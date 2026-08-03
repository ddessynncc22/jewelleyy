const express = require('express');
const router = express.Router();
const { getDashboardStats, getInventoryValue } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.get('/stats', protect, getDashboardStats);
router.get('/inventory-value', protect, getInventoryValue);

module.exports = router;
