const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  appointment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment ID is required']
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: ['paid', 'pending'],
      message: 'Payment status must be paid or pending'
    },
    default: 'pending'
  },
  type: {
    type: String,
    required: [true, 'Payment type is required'],
    enum: {
      values: ['cash', 'bank_transfer'],
      message: 'Payment type must be cash or bank_transfer'
    }
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative']
  },
  payable_amount: {
    type: Number,
    required: [true, 'Payable amount is required'],
    min: [0, 'Payable amount cannot be negative']
  },
  notes: {
    type: String,
    trim: true,
    default: null
  },
  parent_appointment_ids: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Appointment',
    default: []
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Indexes for efficient queries
paymentSchema.index({ appointment_id: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ createdAt: 1 });

// Virtual to validate payable_amount = amount - discount
paymentSchema.pre('save', function(next) {
  const calculatedPayable = this.amount - this.discount;
  if (Math.abs(this.payable_amount - calculatedPayable) > 0.01) {
    // Allow slight differences due to floating point, but warn
    console.warn('Payable amount does not match calculated amount. Setting to calculated value.');
    this.payable_amount = calculatedPayable;
  }
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);


