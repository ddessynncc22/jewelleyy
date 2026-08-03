const express = require('express');
const router = express.Router();
const { login, logout, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { register, forgotPassword } = require('../controllers/accessRequestController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;
