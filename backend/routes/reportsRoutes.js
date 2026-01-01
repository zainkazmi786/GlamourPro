const express = require('express');
const router = express.Router();
const {
  getRevenueExpenses,
  getPopularServices,
  getStaffPerformance,
  getSummary,
  exportReports
} = require('../controllers/reportsController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All reports routes are protected and manager-only
router.use(protect);
router.use(authorize('manager'));

router.get('/revenue-expenses', getRevenueExpenses);
router.get('/popular-services', getPopularServices);
router.get('/staff-performance', getStaffPerformance);
router.get('/summary', getSummary);
router.get('/export', exportReports);

module.exports = router;
