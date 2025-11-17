const mongoose = require('mongoose');

const serviceVariationSchema = new mongoose.Schema({
  variationName: {
    type: String,
    required: [true, 'Variation name is required'],
    trim: true
  },
  timeDuration: {
    type: Number,
    required: [true, 'Time duration is required'],
    min: [1, 'Time duration must be at least 1 minute'],
    max: [480, 'Time duration cannot exceed 480 minutes (8 hours)']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  commission: {
    type: Number,
    required: [true, 'Commission is required'],
    min: [0, 'Commission cannot be negative'],
    max: [100, 'Commission cannot exceed 100%']
  },
  baseService: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BaseService',
    required: [true, 'Base service is required']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('ServiceVariation', serviceVariationSchema);








