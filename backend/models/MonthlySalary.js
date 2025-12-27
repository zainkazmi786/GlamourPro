const mongoose = require('mongoose');

const monthlySalarySchema = new mongoose.Schema({
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
  baseDailySalary: {
    type: Number,
    required: true,
    min: 0
  },
  baseMonthlySalary: {
    type: Number,
    default: 0,
    min: 0
  },
  workingDaysInMonth: {
    type: Number,
    default: 0,
    min: 1
  },
  actualWorkingDays: {
    type: Number,
    default: 0,
    min: 0
    // Can be decimal (e.g., 1.5 days from half-days conversion)
  },
  paidLeavesTaken: {
    type: Number,
    default: 0,
    min: 0
  },
  unpaidLeavesTaken: {
    type: Number,
    default: 0,
    min: 0
  },
  overtimeDays: {
    type: Number,
    default: 0,
    min: 0
  },
  shortDays: {
    type: Number,
    default: 0,
    min: 0
  },
  companyClosureDays: {
    type: Number,
    default: 0,
    min: 0
  },
  payableDays: {
    type: Number,
    required: true,
    min: 0
    // Can be decimal (e.g., 20.5 days)
  },
  deductionDays: {
    type: Number,
    required: true,
    min: 0
    // Can be decimal (e.g., 1.5 days)
  },
  netSalary: {
    type: Number,
    required: true,
    min: 0
  },
  commission: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['draft', 'finalized', 'paid'],
    default: 'draft'
  }
}, {
  timestamps: true
});

// Compound unique index to prevent duplicate salary records for same staff, month, and year
monthlySalarySchema.index({ staffId: 1, month: 1, year: 1 }, { unique: true });

// Index for queries
monthlySalarySchema.index({ year: 1, month: 1 });
monthlySalarySchema.index({ status: 1 });

module.exports = mongoose.model('MonthlySalary', monthlySalarySchema);




