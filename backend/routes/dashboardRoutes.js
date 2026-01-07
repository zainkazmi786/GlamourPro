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
const { protect, authorize } = require('../middleware/authMiddleware');

// All dashboard routes are protected
router.use(protect);

// Revenue routes - Manager only (Therapist cannot see revenue)
router.get('/today-revenue', authorize('manager'), getTodayRevenue);
router.get('/monthly-revenue', authorize('manager'), getMonthlyRevenue);
router.get('/weekly-revenue', authorize('manager'), getWeeklyRevenue);

// Statistics routes - All roles (filtered in controller)
router.get('/active-clients', getActiveClients);
router.get('/today-appointments', getTodayAppointments);
router.get('/staff-on-duty', getStaffOnDuty);
router.get('/popular-services', getPopularServices);
router.get('/today-appointments-list', getTodayAppointmentsList);

module.exports = router;






