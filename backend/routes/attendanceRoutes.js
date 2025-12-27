const express = require('express');
const router = express.Router();
const {
  importAttendance,
  getAllAttendance,
  getAttendanceByStaff,
  getAttendanceSummary,
  bulkDeleteAttendance
} = require('../controllers/attendanceController');
const { uploadCSV } = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');

// All attendance routes are protected
router.use(protect);

router.post('/import', uploadCSV, importAttendance);
router.get('/', getAllAttendance);
router.get('/staff/:staffId', getAttendanceByStaff);
router.get('/summary', getAttendanceSummary);
router.delete('/bulk', bulkDeleteAttendance);

module.exports = router;




