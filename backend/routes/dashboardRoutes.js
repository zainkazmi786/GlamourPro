const express = require('express');
const router = express.Router();
const {
  getTodayRevenue,
  getActiveClients,
  getTodayAppointments,
  getMonthlyRevenue,
  getStaffOnDuty,
  getWeeklyRevenue,
  getPopularServices,
  getTodayAppointmentsList
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

// All dashboard routes are protected
router.use(protect);

router.get('/today-revenue', getTodayRevenue);
router.get('/active-clients', getActiveClients);
router.get('/today-appointments', getTodayAppointments);
router.get('/monthly-revenue', getMonthlyRevenue);
router.get('/staff-on-duty', getStaffOnDuty);
router.get('/weekly-revenue', getWeeklyRevenue);
router.get('/popular-services', getPopularServices);
router.get('/today-appointments-list', getTodayAppointmentsList);

module.exports = router;

