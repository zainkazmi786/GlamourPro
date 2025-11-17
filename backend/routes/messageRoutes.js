const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
  getMessages,
  getMessageById,
  sendMessage,
  uploadFile,
  editMessage,
  deleteMessage,
  markMessageAsRead,
  markChatAsRead,
  getUnreadCount
} = require('../controllers/messageController');

// All routes are protected
router.use(protect);

// Message routes
router.get('/chats/:chatId/messages', getMessages);
router.post('/chats/:chatId/messages', sendMessage);
router.post('/chats/:chatId/messages/upload', uploadSingle, uploadFile);
router.post('/chats/:chatId/mark-read', markChatAsRead);
router.get('/chats/:chatId/unread-count', getUnreadCount);

router.get('/messages/:id', getMessageById);
router.put('/messages/:id', editMessage);
router.delete('/messages/:id', deleteMessage);
router.post('/messages/:id/read', markMessageAsRead);

module.exports = router;



