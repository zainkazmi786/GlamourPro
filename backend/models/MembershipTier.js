const mongoose = require('mongoose');

const membershipTierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tier name is required'],
    unique: true,
    trim: true
  },
  discount_percent: {
    type: Number,
    required: [true, 'Discount percentage is required'],
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },
  points_per_session: {
    type: Number,
    required: [true, 'Points per session is required'],
    min: [0, 'Points per session cannot be negative']
  },
  point_value: {
    type: Number,
    required: [true, 'Point value is required'],
    min: [0, 'Point value cannot be negative']
  },
  redemption_threshold: {
    type: Number,
    required: [true, 'Redemption threshold is required'],
    min: [0, 'Redemption threshold cannot be negative']
  },
  max_sessions_before_reset: {
    type: Number,
    default: null,
    min: [0, 'Max sessions cannot be negative']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MembershipTier', membershipTierSchema);
