const mongoose = require('mongoose');

const sessionResetLogSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client ID is required']
  },
  sessionsReset: {
    type: Number,
    required: [true, 'Sessions reset count is required'],
    min: [0, 'Sessions reset cannot be negative']
  },
  resetBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Staff ID is required']
  },
  resetDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Indexes for efficient queries
sessionResetLogSchema.index({ clientId: 1, resetDate: -1 });
sessionResetLogSchema.index({ resetBy: 1 });

module.exports = mongoose.model('SessionResetLog', sessionResetLogSchema);
