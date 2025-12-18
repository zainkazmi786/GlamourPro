const express = require('express');
const router = express.Router();
const { login, getMe, updatePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/login', login);

// Protected routes (middleware applied but you can remove it later if needed)
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);

module.exports = router;







