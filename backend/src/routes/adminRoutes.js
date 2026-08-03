const express = require('express');
const router = express.Router();
const {
  getDashboardStats, toggleTenantStatus,
  getTenantUsers, createTenantUser, updateTenantUser,
  createBroadcastNotification, getBroadcastNotifications,
  getRateHistory,
} = require('../controllers/adminController');
const {
  listRequests, getRequest, approveRequest, rejectRequest,
} = require('../controllers/accessRequestController');
const { protect, authorize } = require('../middleware/auth');

router.get('/stats', protect, authorize('superadmin'), getDashboardStats);
router.put('/tenants/:id/toggle-status', protect, authorize('superadmin'), toggleTenantStatus);


router.get('/tenants/:id/users', protect, authorize('superadmin'), getTenantUsers);
router.post('/tenants/:id/users', protect, authorize('superadmin'), createTenantUser);
router.put('/tenants/:id/users/:userId', protect, authorize('superadmin'), updateTenantUser);

router.get('/requests', protect, authorize('superadmin'), listRequests);
router.get('/requests/:id', protect, authorize('superadmin'), getRequest);
router.post('/requests/:id/approve', protect, authorize('superadmin'), approveRequest);
router.post('/requests/:id/reject', protect, authorize('superadmin'), rejectRequest);

router.post('/notifications/broadcast', protect, authorize('superadmin'), createBroadcastNotification);
router.get('/notifications/broadcast', protect, authorize('superadmin'), getBroadcastNotifications);

router.get('/rate-history', protect, authorize('superadmin'), getRateHistory);

module.exports = router;
