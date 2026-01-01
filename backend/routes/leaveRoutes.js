const express = require('express');
const router = express.Router();
const {
  createLeave,
  getAllLeaves,
  getLeavesByStaff,
  getLeaveQuota,
  updateLeave,
  deleteLeave
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All leave routes are protected
router.use(protect);

// All roles can view and create leaves (filtered in controller)
router.route('/')
  .get(getAllLeaves)
  .post(createLeave);

router.get('/staff/:staffId', getLeavesByStaff);
router.get('/quota/:staffId', getLeaveQuota);

// Update and delete - Only Manager can approve/delete
router.route('/:id')
  .put(authorize('manager'), updateLeave) // Only Manager can approve
  .delete(authorize('manager'), deleteLeave);

module.exports = router;







