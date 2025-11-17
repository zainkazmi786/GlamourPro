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
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(getAllStaff)
  .post(createStaff);

// Chat users route (protected) - Must be before /:id route
router.get('/chat-users', protect, getChatUsers);

router.route('/:id')
  .get(getStaffById)
  .put(updateStaff)
  .delete(deleteStaff);

router.route('/:id/status')
  .patch(updateStaffStatus);

module.exports = router;







