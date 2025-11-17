const mongoose = require('mongoose');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const Staff = require('../models/Staff');
const path = require('path');
const fs = require('fs');

// Ensure chat uploads directory exists
const chatUploadsDir = path.join(__dirname, '../uploads/chat');
if (!fs.existsSync(chatUploadsDir)) {
  fs.mkdirSync(chatUploadsDir, { recursive: true });
}

// @desc    Get messages for a chat with pagination
// @route   GET /api/chats/:chatId/messages
// @access  Protected
const getMessages = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const staffId = req.staff.id;
    const { page = 1, limit = 50 } = req.query;

    // Validate chat ID
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }

    // Check if chat exists and staff is a member
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Get total count first (needed for proper pagination)
    const totalMessages = await Message.countDocuments({
      chatId: chatId,
      isDeleted: false
    });

    // For chat UI, we want to show latest messages first
    // Page 1: Latest 50 messages (messages 51-100 if total is 100)
    // Page 2: Next older 50 messages (messages 1-50 if total is 100)
    // Sort by createdAt ascending (oldest first), then skip to get the right batch
    const skip = Math.max(0, totalMessages - (pageNum * limitNum));
    const actualLimit = Math.min(limitNum, totalMessages - skip);

    // Get messages sorted by createdAt ascending (oldest first)
    // This ensures chronological order across all pages
    const messages = await Message.find({
      chatId: chatId,
      isDeleted: false
    })
      .populate('senderId', 'name phone email role')
      .populate('replyTo')
      .sort({ createdAt: 1 }) // Ascending: oldest first
      .skip(skip)
      .limit(actualLimit)
      .lean();

    // Update last read message for current user
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      await Chat.updateOne(
        { _id: chatId, 'members.userId': staffId },
        {
          $set: {
            'members.$.lastReadMessageId': lastMessage._id,
            'members.$.lastReadAt': new Date()
          }
        }
      );
    }

    res.status(200).json({
      success: true,
      data: {
        data: messages,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalMessages,
          pages: Math.ceil(totalMessages / limitNum),
          hasMore: skip > 0 // Has more older messages if skip > 0
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

// @desc    Get message by ID
// @route   GET /api/messages/:id
// @access  Protected
const getMessageById = async (req, res) => {
  try {
    const messageId = req.params.id;
    const staffId = req.staff.id;

    const message = await Message.findById(messageId)
      .populate('senderId', 'name phone email role')
      .populate('replyTo')
      .populate('chatId');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if staff is a member of the chat
    const chat = await Chat.findById(message.chatId);
    if (!chat || !chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Get message by ID error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching message',
      error: error.message
    });
  }
};

// @desc    Send a message (REST fallback)
// @route   POST /api/chats/:chatId/messages
// @access  Protected
const sendMessage = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const staffId = req.staff.id;
    const { content, messageType = 'text', replyTo } = req.body;

    // Validate chat ID
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Validate message length (300 words = approximately 1800 characters)
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount > 300) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 300 words'
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters'
      });
    }

    // Check if chat exists and staff is a member
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // Validate replyTo if provided
    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reply to message ID'
        });
      }

      const replyMessage = await Message.findById(replyTo);
      if (!replyMessage || replyMessage.chatId.toString() !== chatId) {
        return res.status(400).json({
          success: false,
          message: 'Reply message not found or not in this chat'
        });
      }
    }

    // Create message
    const messageData = {
      chatId: chatId,
      senderId: staffId,
      content: content.trim(),
      messageType: messageType || 'text'
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const message = await Message.create(messageData);

    // Update chat's lastMessage and lastMessageAt
    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    // Populate and return
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name phone email role')
      .populate('replyTo');

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Send message error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID or message ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

// @desc    Upload file for message
// @route   POST /api/chats/:chatId/messages/upload
// @access  Protected
const uploadFile = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const staffId = req.staff.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required'
      });
    }

    // Validate chat ID
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }

    // Check if chat exists and staff is a member
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // Determine message type based on file MIME type
    let messageType = 'file';
    if (req.file.mimetype.startsWith('image/')) {
      messageType = 'image';
    }

    // Create file URL (relative to uploads folder)
    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    const fileType = req.file.mimetype;

    // Create message with file
    const messageData = {
      chatId: chatId,
      senderId: staffId,
      content: fileName, // Use filename as content for file messages
      messageType: messageType,
      fileUrl: fileUrl,
      fileName: fileName,
      fileSize: fileSize,
      fileType: fileType
    };

    const message = await Message.create(messageData);

    // Update chat's lastMessage and lastMessageAt
    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    // Populate and return
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name phone email role')
      .populate('replyTo');

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Upload file error:', error);
    // Delete uploaded file if message creation fails
    if (req.file) {
      const filePath = path.join(chatUploadsDir, req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
};

// @desc    Edit a message
// @route   PUT /api/messages/:id
// @access  Protected (sender only)
const editMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const staffId = req.staff.id;
    const { content } = req.body;

    // Validate content
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Validate message length (300 words)
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount > 300) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 300 words'
      });
    }

    if (content.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters'
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if staff is the sender
    if (message.senderId.toString() !== staffId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only edit your own messages'
      });
    }

    // Cannot edit file messages
    if (message.messageType !== 'text') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit file messages'
      });
    }

    // Update message
    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // Populate and return
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name phone email role')
      .populate('replyTo');

    res.status(200).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    console.error('Edit message error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error editing message',
      error: error.message
    });
  }
};

// @desc    Delete a message (soft delete)
// @route   DELETE /api/messages/:id
// @access  Protected (sender only)
const deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const staffId = req.staff.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if staff is the sender
    if (message.senderId.toString() !== staffId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    // Optionally delete file if it's a file message
    if (message.fileUrl) {
      const filePath = path.join(__dirname, '..', message.fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting message',
      error: error.message
    });
  }
};

// @desc    Mark message as read
// @route   POST /api/messages/:id/read
// @access  Protected
const markMessageAsRead = async (req, res) => {
  try {
    const messageId = req.params.id;
    const staffId = req.staff.id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if staff is a member of the chat
    const chat = await Chat.findById(message.chatId);
    if (!chat || !chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // Mark as read if not already read
    if (!message.isReadBy(staffId)) {
      message.markAsRead(staffId);
      await message.save();
    }

    res.status(200).json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message as read error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error marking message as read',
      error: error.message
    });
  }
};

// @desc    Mark all messages in chat as read
// @route   POST /api/chats/:chatId/mark-read
// @access  Protected
const markChatAsRead = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const staffId = req.staff.id;

    // Validate chat ID
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }

    // Check if chat exists and staff is a member
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // Get last message in chat
    const lastMessage = await Message.findOne({
      chatId: chatId,
      isDeleted: false
    })
      .sort({ createdAt: -1 })
      .select('_id');

    if (lastMessage) {
      // Update member's last read message
      await Chat.updateOne(
        { _id: chatId, 'members.userId': staffId },
        {
          $set: {
            'members.$.lastReadMessageId': lastMessage._id,
            'members.$.lastReadAt': new Date()
          }
        }
      );

      // Mark all unread messages as read
      await Message.updateMany(
        {
          chatId: chatId,
          senderId: { $ne: staffId },
          isDeleted: false,
          'readBy.userId': { $ne: staffId }
        },
        {
          $push: {
            readBy: {
              userId: staffId,
              readAt: new Date()
            }
          }
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Chat marked as read'
    });
  } catch (error) {
    console.error('Mark chat as read error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error marking chat as read',
      error: error.message
    });
  }
};

// @desc    Get unread message count for a chat
// @route   GET /api/chats/:chatId/unread-count
// @access  Protected
const getUnreadCount = async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const staffId = req.staff.id;

    // Validate chat ID
    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }

    // Check if chat exists and staff is a member
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // Get member's last read message
    const member = chat.members.find(m => m.userId.toString() === staffId.toString());
    const lastReadMessageId = member?.lastReadMessageId;

    // Count unread messages
    let unreadCount = 0;
    if (lastReadMessageId) {
      unreadCount = await Message.countDocuments({
        chatId: chatId,
        senderId: { $ne: staffId },
        _id: { $gt: lastReadMessageId },
        isDeleted: false
      });
    } else {
      // If no last read message, count all messages not sent by current user
      unreadCount = await Message.countDocuments({
        chatId: chatId,
        senderId: { $ne: staffId },
        isDeleted: false
      });
    }

    res.status(200).json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
};

module.exports = {
  getMessages,
  getMessageById,
  sendMessage,
  uploadFile,
  editMessage,
  deleteMessage,
  markMessageAsRead,
  markChatAsRead,
  getUnreadCount
};
