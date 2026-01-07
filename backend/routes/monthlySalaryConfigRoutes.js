const express = require('express');
const router = express.Router();
const {
  createOrUpdateConfig,
  getAllConfigs,
  getConfigByStaff
} = require('../controllers/monthlySalaryConfigController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All salary config routes are protected
router.use(protect);

// Salary config routes - Only Receptionist and Manager can access
router.use(authorize('receptionist', 'manager'));

router.route('/')
  .get(getAllConfigs)
  .post(createOrUpdateConfig);

router.get('/staff/:staffId', getConfigByStaff);

module.exports = router;









