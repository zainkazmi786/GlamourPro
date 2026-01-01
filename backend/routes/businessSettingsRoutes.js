const express = require('express');
const router = express.Router();
const {
  getBusinessSettings,
  updateBusinessSettings
} = require('../controllers/businessSettingsController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All business settings routes are protected
router.use(protect);

// Business settings - Manager only
router.get('/', authorize('manager'), getBusinessSettings);
router.put('/', authorize('manager'), updateBusinessSettings);

module.exports = router;
