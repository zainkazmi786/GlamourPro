const jwt = require('jsonwebtoken');
const Staff = require('../models/Staff');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Store online users (in-memory, can be moved to Redis for scalability)
const onlineUsers = new Map(); // Map<staffId, socketId>

module.exports = (io) => {
  // Socket.io authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key-change-in-production');

        // Get staff from token
        const staff = await Staff.findById(decoded.id);

        if (!staff) {
          return next(new Error('Authentication error: Staff not found'));
        }

        // Check if staff is active
        if (staff.status !== 'Active') {
          return next(new Error('Authentication error: Account is not active'));
        }

        // Attach staff to socket
        socket.staffId = staff._id.toString();
        socket.staff = staff;

        next();
      } catch (error) {
        return next(new Error('Authentication error: Invalid token'));
      }
    } catch (error) {
      next(new Error('Authentication error: ' + error.message));
    }
  });

  // Handle connection
  io.on('connection', async (socket) => {
    const staffId = socket.staffId;
    const staff = socket.staff;

    console.log(`Staff ${staff.name} (${staffId}) connected`);

    // Add to online users
    onlineUsers.set(staffId, socket.id);

    // Join personal room
    socket.join(`staff:${staffId}`);

    // Get all chats for this staff member
    const chats = await Chat.find({
      'members.userId': staffId,
      isActive: true
    }).select('_id');

    // Join all chat rooms
    chats.forEach(chat => {
      socket.join(`chat:${chat._id}`);
    });

    // Emit online status to all relevant chats
    chats.forEach(async (chat) => {
      socket.to(`chat:${chat._id}`).emit('user_online', {
        userId: staffId,
        chatId: chat._id
      });
    });

    // Handle join chat
    socket.on('join_chat', async (data) => {
      try {
        const { chatId } = data;

        if (!chatId) {
          return socket.emit('error', { message: 'Chat ID is required' });
        }

        // Check if staff is a member of the chat
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.isMember(staffId)) {
          return socket.emit('error', { message: 'You are not a member of this chat' });
        }

        // Join chat room
        socket.join(`chat:${chatId}`);

        socket.emit('joined_chat', { chatId });
      } catch (error) {
        console.error('Join chat error:', error);
        socket.emit('error', { message: 'Error joining chat' });
      }
    });

    // Handle leave chat
    socket.on('leave_chat', async (data) => {
      try {
        const { chatId } = data;

        if (chatId) {
          socket.leave(`chat:${chatId}`);
          socket.emit('left_chat', { chatId });
        }
      } catch (error) {
        console.error('Leave chat error:', error);
        socket.emit('error', { message: 'Error leaving chat' });
      }
    });

    // Handle send message
    socket.on('send_message', async (data) => {
      try {
        const { chatId, content, messageType = 'text', replyTo } = data;

        if (!chatId || !content) {
          return socket.emit('error', { message: 'Chat ID and content are required' });
        }

        // Validate message length (300 words)
        const wordCount = content.trim().split(/\s+/).length;
        if (wordCount > 300) {
          return socket.emit('error', { message: 'Message cannot exceed 300 words' });
        }

        if (content.trim().length > 2000) {
          return socket.emit('error', { message: 'Message cannot exceed 2000 characters' });
        }

        // Check if staff is a member of the chat
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.isMember(staffId)) {
          return socket.emit('error', { message: 'You are not a member of this chat' });
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

        // Populate message
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name phone email role')
          .populate('replyTo');

        // Emit to all members of the chat
        io.to(`chat:${chatId}`).emit('message_received', {
          message: populatedMessage,
          chatId: chatId
        });

        // Send confirmation to sender
        socket.emit('message_sent', {
          message: populatedMessage,
          chatId: chatId
        });
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });

    // Handle edit message
    socket.on('edit_message', async (data) => {
      try {
        const { messageId, content } = data;

        if (!messageId || !content) {
          return socket.emit('error', { message: 'Message ID and content are required' });
        }

        // Validate message length
        const wordCount = content.trim().split(/\s+/).length;
        if (wordCount > 300) {
          return socket.emit('error', { message: 'Message cannot exceed 300 words' });
        }

        const message = await Message.findById(messageId);

        if (!message) {
          return socket.emit('error', { message: 'Message not found' });
        }

        // Check if staff is the sender
        if (message.senderId.toString() !== staffId.toString()) {
          return socket.emit('error', { message: 'You can only edit your own messages' });
        }

        // Cannot edit file messages
        if (message.messageType !== 'text') {
          return socket.emit('error', { message: 'Cannot edit file messages' });
        }

        // Update message
        message.content = content.trim();
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        // Populate message
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name phone email role')
          .populate('replyTo');

        // Emit to all members of the chat
        io.to(`chat:${message.chatId}`).emit('message_edited', {
          message: populatedMessage,
          chatId: message.chatId
        });
      } catch (error) {
        console.error('Edit message error:', error);
        socket.emit('error', { message: 'Error editing message' });
      }
    });

    // Handle delete message
    socket.on('delete_message', async (data) => {
      try {
        const { messageId } = data;

        if (!messageId) {
          return socket.emit('error', { message: 'Message ID is required' });
        }

        const message = await Message.findById(messageId);

        if (!message) {
          return socket.emit('error', { message: 'Message not found' });
        }

        // Check if staff is the sender
        if (message.senderId.toString() !== staffId.toString()) {
          return socket.emit('error', { message: 'You can only delete your own messages' });
        }

        // Soft delete
        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        // Emit to all members of the chat
        io.to(`chat:${message.chatId}`).emit('message_deleted', {
          messageId: messageId,
          chatId: message.chatId
        });
      } catch (error) {
        console.error('Delete message error:', error);
        socket.emit('error', { message: 'Error deleting message' });
      }
    });

    // Handle typing start
    socket.on('typing_start', async (data) => {
      try {
        const { chatId } = data;

        if (!chatId) {
          return;
        }

        // Check if staff is a member of the chat
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.isMember(staffId)) {
          return;
        }

        // Emit to other members of the chat
        socket.to(`chat:${chatId}`).emit('user_typing', {
          userId: staffId,
          userName: staff.name,
          chatId: chatId
        });
      } catch (error) {
        console.error('Typing start error:', error);
      }
    });

    // Handle typing stop
    socket.on('typing_stop', async (data) => {
      try {
        const { chatId } = data;

        if (!chatId) {
          return;
        }

        // Emit to other members of the chat
        socket.to(`chat:${chatId}`).emit('user_stopped_typing', {
          userId: staffId,
          chatId: chatId
        });
      } catch (error) {
        console.error('Typing stop error:', error);
      }
    });

    // Handle mark read
    socket.on('mark_read', async (data) => {
      try {
        const { chatId } = data;

        if (!chatId) {
          return;
        }

        // Check if staff is a member of the chat
        const chat = await Chat.findById(chatId);

        if (!chat || !chat.isMember(staffId)) {
          return;
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

          // Emit to other members of the chat
          socket.to(`chat:${chatId}`).emit('messages_read', {
            userId: staffId,
            chatId: chatId
          });
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Handle create group
    socket.on('create_group', async (data) => {
      try {
        const { name, description, members, avatar } = data;

        if (!name || !members || !Array.isArray(members) || members.length === 0) {
          return socket.emit('error', { message: 'Group name and members are required' });
        }

        // Validate all members exist and are active
        const allMemberIds = [staffId, ...members];
        const uniqueMemberIds = [...new Set(allMemberIds.map(id => id.toString()))];
        
        const staffMembers = await Staff.find({
          _id: { $in: uniqueMemberIds },
          status: 'Active'
        });

        if (staffMembers.length !== uniqueMemberIds.length) {
          return socket.emit('error', { message: 'Some members are invalid or inactive' });
        }

        // Create chat members array
        const chatMembers = uniqueMemberIds.map(memberId => ({
          userId: memberId,
          role: memberId === staffId.toString() ? 'admin' : 'member',
          joinedAt: new Date()
        }));

        // Create chat
        const chatData = {
          type: 'group',
          name: name.trim(),
          description: description?.trim() || null,
          createdBy: staffId,
          members: chatMembers,
          admins: [staffId],
          isActive: true
        };

        if (avatar) {
          chatData.avatar = avatar;
        }

        const chat = await Chat.create(chatData);

        // Populate chat
        const populatedChat = await Chat.findById(chat._id)
          .populate('createdBy', 'name phone email')
          .populate('members.userId', 'name phone email role')
          .populate('admins', 'name phone email role');

        // Join all members to chat room
        uniqueMemberIds.forEach(memberId => {
          io.to(`staff:${memberId}`).socketsJoin(`chat:${chat._id}`);
        });

        // Emit to all members
        uniqueMemberIds.forEach(memberId => {
          io.to(`staff:${memberId}`).emit('chat_created', {
            chat: populatedChat
          });
        });
      } catch (error) {
        console.error('Create group error:', error);
        socket.emit('error', { message: 'Error creating group' });
      }
    });

    // Handle add members
    socket.on('add_members', async (data) => {
      try {
        const { chatId, members } = data;

        if (!chatId || !members || !Array.isArray(members) || members.length === 0) {
          return socket.emit('error', { message: 'Chat ID and members are required' });
        }

        const chat = await Chat.findById(chatId);

        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
        }

        // Only group chats can have members added
        if (chat.type !== 'group') {
          return socket.emit('error', { message: 'Can only add members to group chats' });
        }

        // Check if staff is admin
        if (!chat.isAdmin(staffId)) {
          return socket.emit('error', { message: 'Only admins can add members' });
        }

        // Validate members exist and are active
        const staffMembers = await Staff.find({
          _id: { $in: members },
          status: 'Active'
        });

        if (staffMembers.length !== members.length) {
          return socket.emit('error', { message: 'Some members are invalid or inactive' });
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
          return socket.emit('error', { message: 'All members are already in the chat' });
        }

        chat.members.push(...newMembers);
        await chat.save();

        // Populate chat
        const populatedChat = await Chat.findById(chat._id)
          .populate('createdBy', 'name phone email')
          .populate('members.userId', 'name phone email role')
          .populate('admins', 'name phone email role')
          .populate('lastMessage');

        // Join new members to chat room
        newMembers.forEach(member => {
          io.to(`staff:${member.userId}`).socketsJoin(`chat:${chatId}`);
        });

        // Emit to all members
        io.to(`chat:${chatId}`).emit('chat_updated', {
          chat: populatedChat,
          action: 'members_added',
          newMembers: newMembers
        });
      } catch (error) {
        console.error('Add members error:', error);
        socket.emit('error', { message: 'Error adding members' });
      }
    });

    // Handle remove members
    socket.on('remove_members', async (data) => {
      try {
        const { chatId, memberId } = data;

        if (!chatId || !memberId) {
          return socket.emit('error', { message: 'Chat ID and member ID are required' });
        }

        const chat = await Chat.findById(chatId);

        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
        }

        // Only group chats can have members removed
        if (chat.type !== 'group') {
          return socket.emit('error', { message: 'Can only remove members from group chats' });
        }

        // Check if staff is admin
        if (!chat.isAdmin(staffId)) {
          return socket.emit('error', { message: 'Only admins can remove members' });
        }

        // Cannot remove admin
        if (chat.isAdmin(memberId)) {
          return socket.emit('error', { message: 'Cannot remove admin from group' });
        }

        // Remove member
        chat.members = chat.members.filter(
          member => member.userId.toString() !== memberId.toString()
        );
        await chat.save();

        // Populate chat
        const populatedChat = await Chat.findById(chat._id)
          .populate('createdBy', 'name phone email')
          .populate('members.userId', 'name phone email role')
          .populate('admins', 'name phone email role')
          .populate('lastMessage');

        // Remove member from chat room
        io.to(`staff:${memberId}`).socketsLeave(`chat:${chatId}`);

        // Emit to all members
        io.to(`chat:${chatId}`).emit('chat_updated', {
          chat: populatedChat,
          action: 'member_removed',
          removedMemberId: memberId
        });

        // Emit to removed member
        io.to(`staff:${memberId}`).emit('removed_from_chat', {
          chatId: chatId
        });
      } catch (error) {
        console.error('Remove members error:', error);
        socket.emit('error', { message: 'Error removing member' });
      }
    });

    // Handle update group
    socket.on('update_group', async (data) => {
      try {
        const { chatId, name, description, avatar } = data;

        if (!chatId) {
          return socket.emit('error', { message: 'Chat ID is required' });
        }

        const chat = await Chat.findById(chatId);

        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
        }

        // Only group chats can be updated
        if (chat.type !== 'group') {
          return socket.emit('error', { message: 'Can only update group chats' });
        }

        // Check if staff is admin
        if (!chat.isAdmin(staffId)) {
          return socket.emit('error', { message: 'Only admins can update group settings' });
        }

        // Update fields
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (description !== undefined) updateData.description = description?.trim() || null;
        if (avatar !== undefined) updateData.avatar = avatar || null;

        const updatedChat = await Chat.findByIdAndUpdate(
          chatId,
          updateData,
          { new: true, runValidators: true }
        )
          .populate('createdBy', 'name phone email')
          .populate('members.userId', 'name phone email role')
          .populate('admins', 'name phone email role')
          .populate('lastMessage');

        // Emit to all members
        io.to(`chat:${chatId}`).emit('chat_updated', {
          chat: updatedChat,
          action: 'group_updated'
        });
      } catch (error) {
        console.error('Update group error:', error);
        socket.emit('error', { message: 'Error updating group' });
      }
    });

    // Handle leave group
    socket.on('leave_group', async (data) => {
      try {
        const { chatId } = data;

        if (!chatId) {
          return socket.emit('error', { message: 'Chat ID is required' });
        }

        const chat = await Chat.findById(chatId);

        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
        }

        // Check if staff is a member
        if (!chat.isMember(staffId)) {
          return socket.emit('error', { message: 'You are not a member of this chat' });
        }

        // Cannot leave one-to-one chat
        if (chat.type === 'one-to-one') {
          return socket.emit('error', { message: 'Cannot leave one-to-one chat' });
        }

        // Cannot leave if you're the only admin
        if (chat.isAdmin(staffId) && chat.admins.length === 1) {
          return socket.emit('error', { message: 'Cannot leave group as the only admin' });
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

        // Leave chat room
        socket.leave(`chat:${chatId}`);

        // Emit to other members
        socket.to(`chat:${chatId}`).emit('chat_updated', {
          chat: chat,
          action: 'member_left',
          leftMemberId: staffId
        });

        // Emit confirmation to user
        socket.emit('left_group', { chatId: chatId });
      } catch (error) {
        console.error('Leave group error:', error);
        socket.emit('error', { message: 'Error leaving group' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Staff ${staff.name} (${staffId}) disconnected`);

      // Remove from online users
      onlineUsers.delete(staffId);

      // Get all chats for this staff member
      const chats = await Chat.find({
        'members.userId': staffId,
        isActive: true
      }).select('_id');

      // Emit offline status to all relevant chats
      chats.forEach(chat => {
        socket.to(`chat:${chat._id}`).emit('user_offline', {
          userId: staffId,
          chatId: chat._id
        });
      });
    });
  });

  // Helper function to get online users
  io.getOnlineUsers = () => {
    return Array.from(onlineUsers.keys());
  };

  // Helper function to check if user is online
  io.isUserOnline = (staffId) => {
    return onlineUsers.has(staffId);
  };
};



