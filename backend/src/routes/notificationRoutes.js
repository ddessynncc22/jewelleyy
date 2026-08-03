const express = require('express');
const router = express.Router();
const { getMyNotifications, markNotificationRead } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getMyNotifications);
router.put('/:id/read', protect, markNotificationRead);

module.exports = router;
