const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getAllChats,
  getChatById,
  createChat,
  updateChat,
  deleteChat,
  getChatMembers,
  addMembers,
  removeMember,
  leaveChat,
  getChatUsers
} = require('../controllers/chatController');

// All routes are protected
router.use(protect);

// Chat routes
router.route('/')
  .get(getAllChats)
  .post(createChat);

router.route('/:id')
  .get(getChatById)
  .put(updateChat)
  .delete(deleteChat);

router.get('/:id/members', getChatMembers);
router.post('/:id/members', addMembers);
router.delete('/:id/members/:memberId', removeMember);
router.post('/:id/leave', leaveChat);

module.exports = router;

