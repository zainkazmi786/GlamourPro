const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  biometric_emp_id: {
    type: String,
    required: [true, 'Biometric employee ID is required'],
    index: true
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Staff ID is required'],
    index: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  checkIn: {
    type: Date,
    default: null
  },
  checkOut: {
    type: Date,
    default: null
  },
  overtimeOut: {
    type: Date,
    default: null
  },
  deviceName: {
    type: String,
    default: null
  },
  workingHours: {
    type: Number,
    default: 0,
    min: 0
  },
  overtimeHours: {
    type: Number,
    default: 0,
    min: 0
  },
  shortHours: {
    type: Number,
    default: 0,
    min: 0
  },
  isPresent: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'overtime'],
    default: 'absent'
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate entries for same staff and date
attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

// Index for date range queries
attendanceSchema.index({ date: 1, staffId: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);


