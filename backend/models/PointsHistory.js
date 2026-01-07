const mongoose = require('mongoose');

const pointsHistorySchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client ID is required']
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  points: {
    type: Number,
    required: [true, 'Points amount is required'],
    // Positive for earned, negative for redeemed
  },
  type: {
    type: String,
    required: [true, 'Transaction type is required'],
    enum: {
      values: ['earned', 'redeemed'],
      message: 'Type must be either "earned" or "redeemed"'
    }
  },
  description: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Indexes for efficient queries
pointsHistorySchema.index({ clientId: 1, createdAt: -1 });
pointsHistorySchema.index({ appointmentId: 1 });

module.exports = mongoose.model('PointsHistory', pointsHistorySchema);


