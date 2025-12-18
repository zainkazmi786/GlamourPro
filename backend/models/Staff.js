const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const staffSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
    enum: {
      values: ['therapist', 'receptionist', 'manager'],
      message: 'Role must be therapist, receptionist, or manager'
    },
    default: 'therapist'
  },
  hireDate: {
    type: Date,
    required: [true, 'Hire date is required']
  },
  referralCommission: {
    type: Number,
    default: 0,
    min: [0, 'Referral commission cannot be negative'],
    max: [1, 'Referral commission cannot exceed 1']
  },
  paidLeaves: {
    type: Number,
    default: 0,
    min: [0, 'Paid leaves cannot be negative']
  },
  specialization: {
    type: String,
    required: [true, 'Specialization is required'],
    enum: {
      values: ['Massage & Spa', 'Facial & Skincare', 'Hair & Styling', 'Manicure & Pedicure'],
      message: 'Invalid specialization'
    }
  },
  status: {
    type: String,
    required: true,
    enum: {
      values: ['Active', 'Terminated', 'Resigned', 'On Leave'],
      message: 'Invalid status'
    },
    default: 'Active'
  },
  dailyWage: {
    type: Number,
    default: 0,
    min: [0, 'Daily wage cannot be negative']
  },
  biometric_emp_id: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true,
    default: null
  },
  annualPaidLeavesQuota: {
    type: Number,
    default: 12,
    min: [0, 'Annual paid leaves quota cannot be negative']
  },
  monthlySalary: {
    type: Number,
    default: null,
    min: [0, 'Monthly salary cannot be negative']
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Indexes
staffSchema.index({ phone: 1 }); // Already unique, but explicit index
staffSchema.index({ role: 1 }); // For role-based queries
staffSchema.index({ biometric_emp_id: 1 }); // For attendance matching

// Hash password before saving
staffSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
staffSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Generate JWT token method
staffSchema.methods.generateToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET || 'default-secret-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = mongoose.model('Staff', staffSchema);







