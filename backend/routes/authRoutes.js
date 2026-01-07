const express = require('express');
const router = express.Router();
const { login, getMe, updatePassword, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);

module.exports = router;







