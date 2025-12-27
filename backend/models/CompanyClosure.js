const mongoose = require('mongoose');

const companyClosureSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: [true, 'Date is required'],
    unique: true,
    index: true
  },
  reason: {
    type: String,
    trim: true,
    default: null
  },
  isHoliday: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for date range queries
companyClosureSchema.index({ date: 1 });

module.exports = mongoose.model('CompanyClosure', companyClosureSchema);




