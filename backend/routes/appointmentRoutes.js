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

router.route('/')
  .get(getAllAppointments)
  .post(createAppointment);

router.route('/available-slots')
  .get(getAvailableSlots);

router.route('/:id')
  .get(getAppointmentById)
  .put(updateAppointment)
  .delete(deleteAppointment);

router.route('/:id/status')
  .patch(updateAppointmentStatus);

module.exports = router;











