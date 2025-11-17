const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
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
  dob: {
    type: Date,
    default: null
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: null
  },
  address: {
    type: String,
    trim: true,
    default: null
  },
  notes: {
    type: String,
    trim: true,
    default: null
  },
  membership_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipTier',
    default: null
  },
  points_balance: {
    type: Number,
    default: 0,
    min: 0
  },
  total_sessions: {
    type: Number,
    default: 0,
    min: 0
  },
  rfid_number: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null values
    trim: true,
    default: null
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Client', clientSchema);





