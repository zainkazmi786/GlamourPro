const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Staff = require('../models/Staff');

// @desc    Get all chats for current staff member
// @route   GET /api/chats
// @access  Protected
const getAllChats = async (req, res) => {
  try {
    const staffId = req.staff.id;

    // Find all chats where staff is a member
    const chats = await Chat.find({
      'members.userId': staffId,
      isActive: true
    })
      .populate('createdBy', 'name phone email')
      .populate('members.userId', 'name phone email role')
      .populate('admins', 'name phone email role')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 })
      .lean();

    // Get unread counts for each chat
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        // Get member's last read message
        const member = chat.members.find(m => m.userId._id.toString() === staffId.toString());
        const lastReadMessageId = member?.lastReadMessageId;

        // Count unread messages
        let unreadCount = 0;
        if (lastReadMessageId) {
          unreadCount = await Message.countDocuments({
            chatId: chat._id,
            senderId: { $ne: staffId },
            _id: { $gt: lastReadMessageId },
            isDeleted: false
          });
        } else {
          // If no last read message, count all messages not sent by current user
          unreadCount = await Message.countDocuments({
            chatId: chat._id,
            senderId: { $ne: staffId },
            isDeleted: false
          });
        }

        return {
          ...chat,
          unreadCount
        };
      })
    );

    res.status(200).json({
      success: true,
      count: chatsWithUnread.length,
      data: chatsWithUnread
    });
  } catch (error) {
    console.error('Get all chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chats',
      error: error.message
    });
  }
};

// @desc    Get chat by ID
// @route   GET /api/chats/:id
// @access  Protected
const getChatById = async (req, res) => {
  try {
    const chatId = req.params.id;
    const staffId = req.staff.id;

    const chat = await Chat.findById(chatId)
      .populate('createdBy', 'name phone email')
      .populate('members.userId', 'name phone email role')
      .populate('admins', 'name phone email role')
      .populate('lastMessage');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if staff is a member
    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    res.status(200).json({
      success: true,
      data: chat
    });
  } catch (error) {
    console.error('Get chat by ID error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching chat',
      error: error.message
    });
  }
};

// @desc    Create new chat (one-to-one or group)
// @route   POST /api/chats
// @access  Protected
const createChat = async (req, res) => {
  try {
    const { type, name, description, members, avatar } = req.body;
    const staffId = req.staff.id;

    // Validate type
    if (!type || !['one-to-one', 'group'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Chat type must be one-to-one or group'
      });
    }

    // Validate members
    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Members are required'
      });
    }

    // For one-to-one chat, ensure only 2 members (including creator)
    if (type === 'one-to-one') {
      if (members.length !== 1) {
        return res.status(400).json({
          success: false,
          message: 'One-to-one chat must have exactly one other member'
        });
      }

      // Check if chat already exists between these two members
      const existingChat = await Chat.findOne({
        type: 'one-to-one',
        'members.userId': { $all: [staffId, members[0]] },
        'members': { $size: 2 },
        isActive: true
      });

      if (existingChat) {
        // Return existing chat
        const chat = await Chat.findById(existingChat._id)
          .populate('createdBy', 'name phone email')
          .populate('members.userId', 'name phone email role')
          .populate('admins', 'name phone email role')
          .populate('lastMessage');

        return res.status(200).json({
          success: true,
          data: chat,
          message: 'Chat already exists'
        });
      }
    }

    // For group chat, validate name
    if (type === 'group') {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Group name is required'
        });
      }
    }

    // Validate all members exist and are active
    const allMemberIds = type === 'one-to-one' ? [staffId, ...members] : [staffId, ...members];
    const uniqueMemberIds = [...new Set(allMemberIds.map(id => id.toString()))];
    
    const staffMembers = await Staff.find({
      _id: { $in: uniqueMemberIds },
      status: 'Active'
    });

    if (staffMembers.length !== uniqueMemberIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some members are invalid or inactive'
      });
    }

    // Create chat members array
    const chatMembers = uniqueMemberIds.map(memberId => ({
      userId: memberId,
      role: memberId === staffId.toString() ? 'admin' : 'member',
      joinedAt: new Date()
    }));

    // Create chat
    const chatData = {
      type,
      createdBy: staffId,
      members: chatMembers,
      admins: [staffId], // Creator is admin
      isActive: true
    };

    if (type === 'group') {
      chatData.name = name.trim();
      if (description) chatData.description = description.trim();
      if (avatar) chatData.avatar = avatar;
    }

    const chat = await Chat.create(chatData);

    // Populate and return
    const populatedChat = await Chat.findById(chat._id)
      .populate('createdBy', 'name phone email')
      .populate('members.userId', 'name phone email role')
      .populate('admins', 'name phone email role');

    res.status(201).json({
      success: true,
      data: populatedChat
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating chat',
      error: error.message
    });
  }
};

// @desc    Update chat (name, description, avatar)
// @route   PUT /api/chats/:id
// @access  Protected (admin only for groups)
const updateChat = async (req, res) => {
  try {
    const chatId = req.params.id;
    const staffId = req.staff.id;
    const { name, description, avatar } = req.body;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if staff is a member
    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // For group chats, only admin can update
    if (chat.type === 'group') {
      if (!chat.isAdmin(staffId)) {
        return res.status(403).json({
          success: false,
          message: 'Only admins can update group settings'
        });
      }
    }

    // Update fields
    const updateData = {};
    if (name !== undefined && chat.type === 'group') {
      updateData.name = name.trim();
    }
    if (description !== undefined && chat.type === 'group') {
      updateData.description = description?.trim() || null;
    }
    if (avatar !== undefined && chat.type === 'group') {
      updateData.avatar = avatar || null;
    }

    const updatedChat = await Chat.findByIdAndUpdate(
      chatId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name phone email')
      .populate('members.userId', 'name phone email role')
      .populate('admins', 'name phone email role')
      .populate('lastMessage');

    res.status(200).json({
      success: true,
      data: updatedChat
    });
  } catch (error) {
    console.error('Update chat error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating chat',
      error: error.message
    });
  }
};

// @desc    Delete chat (admin only for groups)
// @route   DELETE /api/chats/:id
// @access  Protected (admin only for groups)
const deleteChat = async (req, res) => {
  try {
    const chatId = req.params.id;
    const staffId = req.staff.id;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if staff is a member
    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // For group chats, only admin can delete
    if (chat.type === 'group') {
      if (!chat.isAdmin(staffId)) {
        return res.status(403).json({
          success: false,
          message: 'Only admins can delete group chats'
        });
      }
    }

    // Soft delete: set isActive to false
    chat.isActive = false;
    await chat.save();

    res.status(200).json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting chat',
      error: error.message
    });
  }
};

// @desc    Get chat members
// @route   GET /api/chats/:id/members
// @access  Protected
const getChatMembers = async (req, res) => {
  try {
    const chatId = req.params.id;
    const staffId = req.staff.id;

    const chat = await Chat.findById(chatId)
      .populate('members.userId', 'name phone email role')
      .populate('admins', 'name phone email role');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if staff is a member
    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        members: chat.members,
        admins: chat.admins
      }
    });
  } catch (error) {
    console.error('Get chat members error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching chat members',
      error: error.message
    });
  }
};

// @desc    Add members to group (admin only)
// @route   POST /api/chats/:id/members
// @access  Protected (admin only)
const addMembers = async (req, res) => {
  try {
    const chatId = req.params.id;
    const staffId = req.staff.id;
    const { members } = req.body;

    if (!members || !Array.isArray(members) || members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Members are required'
      });
    }

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Only group chats can have members added
    if (chat.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Can only add members to group chats'
      });
    }

    // Check if staff is admin
    if (!chat.isAdmin(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can add members'
      });
    }

    // Validate members exist and are active
    const staffMembers = await Staff.find({
      _id: { $in: members },
      status: 'Active'
    });

    if (staffMembers.length !== members.length) {
      return res.status(400).json({
        success: false,
        message: 'Some members are invalid or inactive'
      });
    }

    // Add members (avoid duplicates)
    const existingMemberIds = chat.members.map(m => m.userId.toString());
    const newMembers = members
      .filter(memberId => !existingMemberIds.includes(memberId.toString()))
      .map(memberId => ({
        userId: memberId,
        role: 'member',
        joinedAt: new Date()
      }));

    if (newMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All members are already in the chat'
      });
    }

    chat.members.push(...newMembers);
    await chat.save();

    // Populate and return
    const populatedChat = await Chat.findById(chat._id)
      .populate('createdBy', 'name phone email')
      .populate('members.userId', 'name phone email role')
      .populate('admins', 'name phone email role')
      .populate('lastMessage');

    res.status(200).json({
      success: true,
      data: populatedChat,
      message: `${newMembers.length} member(s) added successfully`
    });
  } catch (error) {
    console.error('Add members error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID or member ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error adding members',
      error: error.message
    });
  }
};

// @desc    Remove member from group (admin only)
// @route   DELETE /api/chats/:id/members/:memberId
// @access  Protected (admin only)
const removeMember = async (req, res) => {
  try {
    const chatId = req.params.id;
    const memberId = req.params.memberId;
    const staffId = req.staff.id;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Only group chats can have members removed
    if (chat.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Can only remove members from group chats'
      });
    }

    // Check if staff is admin
    if (!chat.isAdmin(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can remove members'
      });
    }

    // Cannot remove admin
    if (chat.isAdmin(memberId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove admin from group'
      });
    }

    // Remove member
    chat.members = chat.members.filter(
      member => member.userId.toString() !== memberId.toString()
    );
    await chat.save();

    // Populate and return
    const populatedChat = await Chat.findById(chat._id)
      .populate('createdBy', 'name phone email')
      .populate('members.userId', 'name phone email role')
      .populate('admins', 'name phone email role')
      .populate('lastMessage');

    res.status(200).json({
      success: true,
      data: populatedChat,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Remove member error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID or member ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error removing member',
      error: error.message
    });
  }
};

// @desc    Leave group chat
// @route   POST /api/chats/:id/leave
// @access  Protected
const leaveChat = async (req, res) => {
  try {
    const chatId = req.params.id;
    const staffId = req.staff.id;

    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if staff is a member
    if (!chat.isMember(staffId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this chat'
      });
    }

    // Cannot leave one-to-one chat (can only delete)
    if (chat.type === 'one-to-one') {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave one-to-one chat. Please delete the chat instead.'
      });
    }

    // Cannot leave if you're the only admin
    if (chat.isAdmin(staffId) && chat.admins.length === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave group as the only admin. Please delete the group or assign another admin.'
      });
    }

    // Remove from admins if admin
    if (chat.isAdmin(staffId)) {
      chat.admins = chat.admins.filter(
        admin => admin.toString() !== staffId.toString()
      );
    }

    // Remove from members
    chat.members = chat.members.filter(
      member => member.userId.toString() !== staffId.toString()
    );
    await chat.save();

    res.status(200).json({
      success: true,
      message: 'Left chat successfully'
    });
  } catch (error) {
    console.error('Leave chat error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error leaving chat',
      error: error.message
    });
  }
};

// @desc    Get staff available for chat
// @route   GET /api/staff/chat-users
// @access  Protected
const getChatUsers = async (req, res) => {
  try {
    const staffId = req.staff.id;

    // Get all active staff members except current user
    const staff = await Staff.find({
      _id: { $ne: staffId },
      status: 'Active'
    })
      .select('name phone email role')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      count: staff.length,
      data: staff
    });
  } catch (error) {
    console.error('Get chat users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chat users',
      error: error.message
    });
  }
};

module.exports = {
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
};







