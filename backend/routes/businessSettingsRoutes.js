const express = require('express');
const router = express.Router();
const {
  getBusinessSettings,
  updateBusinessSettings
} = require('../controllers/businessSettingsController');
const { protect } = require('../middleware/authMiddleware');

// All business settings routes are protected
router.use(protect);

router.get('/', getBusinessSettings);
router.put('/', updateBusinessSettings);

module.exports = router;
