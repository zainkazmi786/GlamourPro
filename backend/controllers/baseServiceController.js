const mongoose = require('mongoose');
const BaseService = require('../models/BaseService');
const ServiceVariation = require('../models/ServiceVariation');

// @desc    Get all base services
// @route   GET /api/base-services
// @access  Public
const getAllBaseServices = async (req, res) => {
  try {
    console.log('getAllBaseServices - Query params:', req.query);
    const { search, category } = req.query;
    let query = {};

    // Filter by category if provided
    if (category) {
      query.category = category;
    }

    // Search by name if search parameter is provided
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const baseServices = await BaseService.find(query)
      .sort({ createdAt: -1 });

    // Get variations for each base service
    const baseServicesWithVariations = await Promise.all(
      baseServices.map(async (service) => {
        const variations = await ServiceVariation.find({
          baseService: service._id,
          isActive: true
        }).select('_id variationName timeDuration price commission baseService isActive createdAt updatedAt');
        
        return {
          ...service.toObject(),
          variations: variations
        };
      })
    );

    console.log(`getAllBaseServices - Found ${baseServicesWithVariations.length} base services`);

    res.status(200).json({
      success: true,
      count: baseServicesWithVariations.length,
      data: baseServicesWithVariations
    });
  } catch (error) {
    console.error('getAllBaseServices - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching base services',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single base service by ID
// @route   GET /api/base-services/:id
// @access  Public
const getBaseServiceById = async (req, res) => {
  try {
    const baseService = await BaseService.findById(req.params.id);

    if (!baseService) {
      return res.status(404).json({
        success: false,
        message: 'Base service not found'
      });
    }

    // Get variations for this base service
    const variations = await ServiceVariation.find({
      baseService: baseService._id,
      isActive: true
    }).select('_id variationName timeDuration price commission baseService isActive createdAt updatedAt');

    const baseServiceWithVariations = {
      ...baseService.toObject(),
      variations: variations
    };

    res.status(200).json({
      success: true,
      data: baseServiceWithVariations
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid base service ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching base service',
      error: error.message
    });
  }
};

// @desc    Create new base service
// @route   POST /api/base-services
// @access  Public
const createBaseService = async (req, res) => {
  try {
    console.log('createBaseService - Request body:', JSON.stringify(req.body, null, 2));
    
    // Helper function to convert empty strings to null
    const toNullIfEmpty = (value) => {
      if (value === undefined || value === null || value === '') return null;
      return value;
    };

    // Prepare base service data
    const baseServiceData = {
      name: req.body.name?.trim(),
      category: req.body.category,
      description: toNullIfEmpty(req.body.description?.trim()),
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    };

    console.log('createBaseService - Processed data:', JSON.stringify(baseServiceData, null, 2));

    const baseService = await BaseService.create(baseServiceData);

    res.status(201).json({
      success: true,
      data: baseService
    });
  } catch (error) {
    console.error('createBaseService - Error:', error);
    console.error('createBaseService - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors
    });
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
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
      message: 'Error creating base service',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update base service
// @route   PUT /api/base-services/:id
// @access  Public
const updateBaseService = async (req, res) => {
  try {
    console.log('updateBaseService - Request params:', req.params);
    console.log('updateBaseService - Request body:', JSON.stringify(req.body, null, 2));

    const baseService = await BaseService.findById(req.params.id);

    if (!baseService) {
      return res.status(404).json({
        success: false,
        message: 'Base service not found'
      });
    }

    // Helper function to convert empty strings to null
    const toNullIfEmpty = (value) => {
      if (value === undefined || value === null || value === '') return null;
      return value;
    };

    // Update only provided fields
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name?.trim();
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.description !== undefined) updateData.description = toNullIfEmpty(req.body.description?.trim());
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    console.log('updateBaseService - Update data:', JSON.stringify(updateData, null, 2));

    const updatedBaseService = await BaseService.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedBaseService
    });
  } catch (error) {
    console.error('updateBaseService - Error:', error);
    console.error('updateBaseService - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors,
      stack: error.stack
    });
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid base service ID'
      });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
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
      message: 'Error updating base service',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete base service
// @route   DELETE /api/base-services/:id
// @access  Public
const deleteBaseService = async (req, res) => {
  try {
    const baseService = await BaseService.findById(req.params.id);

    if (!baseService) {
      return res.status(404).json({
        success: false,
        message: 'Base service not found'
      });
    }

    // Check if base service has active variations
    const variationsCount = await ServiceVariation.countDocuments({
      baseService: req.params.id,
      isActive: true
    });

    if (variationsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete base service. It has ${variationsCount} active variation(s). Please delete or deactivate all variations first.`
      });
    }

    await BaseService.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Base service deleted successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid base service ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting base service',
      error: error.message
    });
  }
};

module.exports = {
  getAllBaseServices,
  getBaseServiceById,
  createBaseService,
  updateBaseService,
  deleteBaseService
};

