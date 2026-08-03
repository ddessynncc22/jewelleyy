const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { protect } = require('../middleware/auth');

router.get('/', protect, alertController.getAlerts);

module.exports = router;
