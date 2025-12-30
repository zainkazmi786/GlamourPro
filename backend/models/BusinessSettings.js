const mongoose = require('mongoose');

const businessSettingsSchema = new mongoose.Schema({
  // Business Information
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    default: 'GlamourSoft Pro Salon'
  },
  contactPhone: {
    type: String,
    trim: true,
    default: '+92 300 1234567'
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: 'info@glamoursoft.com'
  },
  website: {
    type: String,
    trim: true,
    default: 'www.glamoursoft.com'
  },
  address: {
    type: String,
    trim: true,
    default: '123 Beauty Street, Karachi, Pakistan'
  },
  
  // Financial Settings
  currency: {
    type: String,
    default: 'PKR',
    trim: true
  },
  pointValue: {
    type: Number,
    default: 10,
    min: [0, 'Point value cannot be negative']
  },
  redemptionThreshold: {
    type: Number,
    default: 50,
    min: [0, 'Redemption threshold cannot be negative']
  },
  taxRate: {
    type: Number,
    default: 0,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%']
  },
  paymentMethods: {
    cash: {
      type: Boolean,
      default: true
    },
    card: {
      type: Boolean,
      default: true
    },
    bankTransfer: {
      type: Boolean,
      default: true
    },
    eWallet: {
      type: Boolean,
      default: false
    }
  },
  
  // Attendance Settings
  openTime: {
    type: String,
    default: '09:00',
    trim: true
  },
  closeTime: {
    type: String,
    default: '20:00',
    trim: true
  },
  workingDays: {
    type: Number,
    default: 6,
    min: [1, 'Working days must be at least 1'],
    max: [7, 'Working days cannot exceed 7']
  },
  annualLeaves: {
    type: Number,
    default: 15,
    min: [0, 'Annual leaves cannot be negative']
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
businessSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('BusinessSettings', businessSettingsSchema);



