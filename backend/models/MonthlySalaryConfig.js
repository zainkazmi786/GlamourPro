const mongoose = require('mongoose');

const monthlySalaryConfigSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: [true, 'Staff ID is required'],
    index: true
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: [true, 'Year is required']
  },
  baseMonthlySalary: {
    type: Number,
    required: [true, 'Base monthly salary is required'],
    min: [0, 'Base monthly salary cannot be negative']
  },
  workingDaysInMonth: {
    type: Number,
    required: [true, 'Working days in month is required'],
    min: [1, 'Working days must be at least 1'],
    max: [31, 'Working days cannot exceed 31']
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate configs for same staff, month, and year
monthlySalaryConfigSchema.index({ staffId: 1, month: 1, year: 1 }, { unique: true });

// Index for queries
monthlySalaryConfigSchema.index({ year: 1, month: 1 });

module.exports = mongoose.model('MonthlySalaryConfig', monthlySalaryConfigSchema);
