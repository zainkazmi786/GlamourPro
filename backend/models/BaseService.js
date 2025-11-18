const mongoose = require('mongoose');

const baseServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    unique: true,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['Massage & Spa', 'Facial & Skincare', 'Hair & Styling', 'Manicure & Pedicure'],
      message: 'Invalid category'
    }
  },
  description: {
    type: String,
    trim: true,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('BaseService', baseServiceSchema);









