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
const { protect } = require('../middleware/authMiddleware');

// All leave routes are protected
router.use(protect);

router.route('/')
  .get(getAllLeaves)
  .post(createLeave);

router.get('/staff/:staffId', getLeavesByStaff);
router.get('/quota/:staffId', getLeaveQuota);

router.route('/:id')
  .put(updateLeave)
  .delete(deleteLeave);

module.exports = router;






