const express = require('express');
const router = express.Router();
const {
  getAllAppointments,
  getAvailableSlots,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// GET all appointments - All roles (filtered in controller)
router.route('/')
  .get(getAllAppointments)
  // POST - Only Receptionist and Manager can create appointments
  .post(authorize('receptionist', 'manager'), createAppointment);

// GET available slots - All roles
router.route('/available-slots')
  .get(getAvailableSlots);

// GET by ID - All roles (filtered in controller)
router.route('/:id')
  .get(getAppointmentById)
  // PUT - Only Receptionist and Manager can update
  .put(authorize('receptionist', 'manager'), updateAppointment)
  // DELETE - Only Manager can delete
  .delete(authorize('manager'), deleteAppointment);

// PATCH status - Only Receptionist and Manager can update status
router.route('/:id/status')
  .patch(authorize('receptionist', 'manager'), updateAppointmentStatus);

module.exports = router;












