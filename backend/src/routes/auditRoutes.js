const express = require('express');
const router = express.Router();
const { getActivityLogs, getInventoryLog, getStockReconciliation, getDeletedRecords, getSystemLog } = require('../controllers/auditController');
const { protect, authorize } = require('../middleware/auth');

router.get('/activity', protect, getActivityLogs);
router.get('/inventory', protect, getInventoryLog);
router.get('/reconciliation', protect, authorize('admin'), getStockReconciliation);
router.get('/deleted', protect, authorize('admin'), getDeletedRecords);
router.get('/system', protect, getSystemLog);

module.exports = router;
