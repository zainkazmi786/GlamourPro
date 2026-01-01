const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client is required']
  },
  baseServiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BaseService',
    required: [true, 'Base service is required']
  },
  serviceVariationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ServiceVariation',
    required: [true, 'Service variation is required']
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Staff is required']
  },
  startTime: {
    type: Date,
    required: [true, 'Start time is required']
  },
  reference: {
    type: String,
    required: [true, 'Reference is required'],
    enum: {
      values: ['google', 'walk-in', 'staff'],
      message: 'Reference must be one of: google, walk-in, staff'
    }
  },
  referenceStaffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: null
  },
  membership: {
    type: Boolean,
    default: false
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  membershipDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Membership discount cannot be negative']
  },
  staffCommission: {
    type: Number,
    default: 0,
    min: [0, 'Staff commission cannot be negative']
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative']
  },
  payment_ids: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Payment',
    default: []
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled'],
      message: 'Invalid status'
    },
    default: 'scheduled'
  },
  notes: {
    type: String,
    trim: true,
    default: null
  },
  pointsUsed: {
    type: Number,
    default: 0,
    min: [0, 'Points used cannot be negative']
  },
  pointsAwarded: {
    type: Number,
    default: 0,
    min: [0, 'Points awarded cannot be negative']
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Compound index to prevent double booking (same staff at same time)
appointmentSchema.index({ startTime: 1, staffId: 1 }, { unique: true });

// Indexes for efficient queries
appointmentSchema.index({ startTime: 1 });
appointmentSchema.index({ clientId: 1 });
appointmentSchema.index({ staffId: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ payment_ids: 1 });

// Validation: referenceStaffId is required if reference is 'staff'
appointmentSchema.pre('validate', function(next) {
  if (this.reference === 'staff' && !this.referenceStaffId) {
    this.invalidate('referenceStaffId', 'Reference staff is required when reference is "staff"');
  }
  next();
});

module.exports = mongoose.model('Appointment', appointmentSchema);





