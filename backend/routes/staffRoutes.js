const express = require('express');
const router = express.Router();
const {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  updateStaffStatus,
  deleteStaff
} = require('../controllers/staffController');
const { getChatUsers } = require('../controllers/chatController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Chat users route - All roles can access (for chat functionality)
router.get('/chat-users', getChatUsers);

// Staff management routes
router.route('/')
  .get(getAllStaff) // All roles (filtered in controller - therapist sees only self)
  .post(authorize('manager'), createStaff); // Only Manager can create

router.route('/:id')
  .get(getStaffById) // All roles (filtered in controller - therapist sees only self)
  .put(updateStaff) // All roles (filtered in controller - therapist can update only self)
  .delete(authorize('manager'), deleteStaff); // Only Manager can delete

router.route('/:id/status')
  .patch(authorize('manager'), updateStaffStatus); // Only Manager can change status

module.exports = router;







