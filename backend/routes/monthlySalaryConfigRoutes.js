const express = require('express');
const router = express.Router();
const {
  createOrUpdateConfig,
  getAllConfigs,
  getConfigByStaff
} = require('../controllers/monthlySalaryConfigController');
const { protect } = require('../middleware/authMiddleware');

// All salary config routes are protected
router.use(protect);

router.route('/')
  .get(getAllConfigs)
  .post(createOrUpdateConfig);

router.get('/staff/:staffId', getConfigByStaff);

module.exports = router;


