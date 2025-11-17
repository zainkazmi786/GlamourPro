const mongoose = require('mongoose');
const ServiceVariation = require('../models/ServiceVariation');
const BaseService = require('../models/BaseService');

// @desc    Get all service variations
// @route   GET /api/service-variations
// @access  Public
const getAllVariations = async (req, res) => {
  try {
    console.log('getAllVariations - Query params:', req.query);
    const { baseService } = req.query;
    let query = {};

    // Filter by base service if provided
    if (baseService) {
      if (!mongoose.Types.ObjectId.isValid(baseService)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid base service ID'
        });
      }
      query.baseService = baseService;
    }

    const variations = await ServiceVariation.find(query)
      .populate('baseService', 'name category')
      .sort({ createdAt: -1 });

    console.log(`getAllVariations - Found ${variations.length} variations`);

    res.status(200).json({
      success: true,
      count: variations.length,
      data: variations
    });
  } catch (error) {
    console.error('getAllVariations - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching service variations',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get variations by base service ID
// @route   GET /api/service-variations/base-service/:baseServiceId
// @access  Public
const getVariationsByBaseService = async (req, res) => {
  try {
    const { baseServiceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(baseServiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base service ID'
      });
    }

    // Check if base service exists
    const baseService = await BaseService.findById(baseServiceId);
    if (!baseService) {
      return res.status(404).json({
        success: false,
        message: 'Base service not found'
      });
    }

    const variations = await ServiceVariation.find({
      baseService: baseServiceId,
      isActive: true
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: variations.length,
      data: variations
    });
  } catch (error) {
    console.error('getVariationsByBaseService - Error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid base service ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching variations',
      error: error.message
    });
  }
};

// @desc    Get single variation by ID
// @route   GET /api/service-variations/:id
// @access  Public
const getVariationById = async (req, res) => {
  try {
    const variation = await ServiceVariation.findById(req.params.id)
      .populate('baseService', 'name category');

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: 'Service variation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: variation
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid variation ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching service variation',
      error: error.message
    });
  }
};

// @desc    Create new service variation
// @route   POST /api/service-variations
// @access  Public
const createVariation = async (req, res) => {
  try {
    console.log('createVariation - Request body:', JSON.stringify(req.body, null, 2));
    
    // Validate base service ID
    if (!req.body.baseService || !mongoose.Types.ObjectId.isValid(req.body.baseService)) {
      return res.status(400).json({
        success: false,
        message: 'Valid base service ID is required'
      });
    }

    // Check if base service exists
    const baseService = await BaseService.findById(req.body.baseService);
    if (!baseService) {
      return res.status(404).json({
        success: false,
        message: 'Base service not found'
      });
    }

    // Prepare variation data
    const variationData = {
      variationName: req.body.variationName?.trim(),
      timeDuration: req.body.timeDuration !== undefined ? Number(req.body.timeDuration) : null,
      price: req.body.price !== undefined ? Number(req.body.price) : null,
      commission: req.body.commission !== undefined ? Number(req.body.commission) : null,
      baseService: req.body.baseService,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    };

    console.log('createVariation - Processed data:', JSON.stringify(variationData, null, 2));

    const variation = await ServiceVariation.create(variationData);

    // Populate base service in response
    const populatedVariation = await ServiceVariation.findById(variation._id)
      .populate('baseService', 'name category');

    res.status(201).json({
      success: true,
      data: populatedVariation
    });
  } catch (error) {
    console.error('createVariation - Error:', error);
    console.error('createVariation - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors
    });
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating service variation',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update service variation
// @route   PUT /api/service-variations/:id
// @access  Public
const updateVariation = async (req, res) => {
  try {
    console.log('updateVariation - Request params:', req.params);
    console.log('updateVariation - Request body:', JSON.stringify(req.body, null, 2));

    const variation = await ServiceVariation.findById(req.params.id);

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: 'Service variation not found'
      });
    }

    // Validate base service ID if provided
    if (req.body.baseService && !mongoose.Types.ObjectId.isValid(req.body.baseService)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base service ID'
      });
    }

    // Check if base service exists if provided
    if (req.body.baseService) {
      const baseService = await BaseService.findById(req.body.baseService);
      if (!baseService) {
        return res.status(404).json({
          success: false,
          message: 'Base service not found'
        });
      }
    }

    // Update only provided fields
    const updateData = {};
    if (req.body.variationName !== undefined) updateData.variationName = req.body.variationName?.trim();
    if (req.body.timeDuration !== undefined) updateData.timeDuration = Number(req.body.timeDuration);
    if (req.body.price !== undefined) updateData.price = Number(req.body.price);
    if (req.body.commission !== undefined) updateData.commission = Number(req.body.commission);
    if (req.body.baseService !== undefined) updateData.baseService = req.body.baseService;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    console.log('updateVariation - Update data:', JSON.stringify(updateData, null, 2));

    const updatedVariation = await ServiceVariation.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('baseService', 'name category');

    res.status(200).json({
      success: true,
      data: updatedVariation
    });
  } catch (error) {
    console.error('updateVariation - Error:', error);
    console.error('updateVariation - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors,
      stack: error.stack
    });
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid variation ID or base service ID'
      });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating service variation',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete service variation
// @route   DELETE /api/service-variations/:id
// @access  Public
const deleteVariation = async (req, res) => {
  try {
    const variation = await ServiceVariation.findById(req.params.id);

    if (!variation) {
      return res.status(404).json({
        success: false,
        message: 'Service variation not found'
      });
    }

    await ServiceVariation.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Service variation deleted successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid variation ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting service variation',
      error: error.message
    });
  }
};

module.exports = {
  getAllVariations,
  getVariationsByBaseService,
  getVariationById,
  createVariation,
  updateVariation,
  deleteVariation
};








