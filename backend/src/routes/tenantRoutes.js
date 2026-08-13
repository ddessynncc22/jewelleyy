const express = require('express');
const router = express.Router();
const { onboard, getTenant, getTenantById, updateTenant, listTenants } = require('../controllers/tenantController');
const { protect, authorize } = require('../middleware/auth');

router.post('/onboard', protect, authorize('superadmin'), onboard);
router.get('/all', protect, authorize('superadmin'), listTenants);
router.get('/:id', protect, authorize('superadmin'), getTenantById);
router.put('/:id', protect, authorize('superadmin'), updateTenant);
router.get('/', protect, getTenant);
router.put('/', protect, authorize('admin'), updateTenant);

module.exports = router;
