const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Staff ID is required'],
    index: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  type: {
    type: String,
    enum: ['paid', 'unpaid'],
    required: [true, 'Leave type is required']
  },
  days: {
    type: Number,
    required: true,
    min: [0, 'Days cannot be negative']
  },
  reason: {
    type: String,
    trim: true,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  year: {
    type: Number,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Index for queries
leaveSchema.index({ staffId: 1, year: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

// Calculate days before saving
leaveSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
    this.days = diffDays;
    
    // Set year if not set
    if (!this.year) {
      this.year = start.getFullYear();
    }
  }
  next();
});

module.exports = mongoose.model('Leave', leaveSchema);







