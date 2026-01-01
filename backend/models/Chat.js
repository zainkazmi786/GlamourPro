const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Chat type is required'],
    enum: {
      values: ['one-to-one', 'group'],
      message: 'Chat type must be one-to-one or group'
    }
  },
  name: {
    type: String,
    trim: true,
    default: null
  },
  description: {
    type: String,
    trim: true,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Created by is required']
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },
    lastReadAt: {
      type: Date,
      default: null
    },
    isMuted: {
      type: Boolean,
      default: false
    },
    notificationsEnabled: {
      type: Boolean,
      default: true
    }
  }],
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  }],
  avatar: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  lastMessageAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
chatSchema.index({ 'members.userId': 1 });
chatSchema.index({ type: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ createdBy: 1 });
chatSchema.index({ admins: 1 });

// Method to check if user is member
chatSchema.methods.isMember = function(userId) {
  if (!userId) return false;
  return this.members.some(member => {
    if (!member || !member.userId) return false;
    return member.userId.toString() === userId.toString();
  });
};

// Method to check if user is admin
chatSchema.methods.isAdmin = function(userId) {
  if (!userId) return false;
  return this.admins.some(admin => {
    if (!admin) return false;
    return admin.toString() === userId.toString();
  });
};

// Method to get member role
chatSchema.methods.getMemberRole = function(userId) {
  if (!userId) return null;
  const member = this.members.find(m => {
    if (!m || !m.userId) return false;
    return m.userId.toString() === userId.toString();
  });
  return member ? member.role : null;
};

module.exports = mongoose.model('Chat', chatSchema);







