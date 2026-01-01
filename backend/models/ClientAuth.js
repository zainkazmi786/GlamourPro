const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const clientAuthSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: [true, 'Client ID is required'],
    unique: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Indexes
clientAuthSchema.index({ clientId: 1 }); // Unique index already on clientId
clientAuthSchema.index({ phone: 1 }); // Unique index already on phone

// Hash password before saving
clientAuthSchema.pre('save', async function(next) {
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
clientAuthSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Generate JWT token method
clientAuthSchema.methods.generateToken = function() {
  return jwt.sign(
    { id: this.clientId, type: 'client' },
    process.env.JWT_SECRET || 'default-secret-key-change-in-production',
    { expiresIn: process.env.JWT_EXPIRE || '30d' } // Longer expiry for clients
  );
};

module.exports = mongoose.model('ClientAuth', clientAuthSchema);
