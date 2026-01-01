const mongoose = require('mongoose');
const Client = require('../models/Client');
const SessionResetLog = require('../models/SessionResetLog');
const PointsHistory = require('../models/PointsHistory');

// @desc    Get all clients
// @route   GET /api/clients
// @access  Public
const getAllClients = async (req, res) => {
  try {
    console.log('getAllClients - Query params:', req.query);
    const { search, phone, hasMembership } = req.query;
    let query = {};

    // Search by phone number if provided
    if (phone) {
      query.phone = { $regex: phone, $options: 'i' };
    }

    // Search by name or phone if search parameter is provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by membership status
    if (hasMembership === 'true') {
      query.membership_id = { $ne: null };
    } else if (hasMembership === 'false') {
      query.membership_id = null;
    }

    // Try to populate membership_id, but handle gracefully if MembershipTier model doesn't exist
    let clients;
    try {
      clients = await Client.find(query)
        .populate('membership_id', 'name discount_percent points_per_session point_value redemption_threshold isActive')
        .sort({ createdAt: -1 });
    } catch (populateError) {
      // If populate fails, just get clients without population
      console.warn('Populate failed, fetching without membership:', populateError.message);
      clients = await Client.find(query)
        .sort({ createdAt: -1 });
    }

    console.log(`getAllClients - Found ${clients.length} clients`);

    res.status(200).json({
      success: true,
      count: clients.length,
      data: clients
    });
  } catch (error) {
    console.error('getAllClients - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clients',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single client by ID
// @route   GET /api/clients/:id
// @access  Public
const getClientById = async (req, res) => {
  try {
    let client;
    try {
      client = await Client.findById(req.params.id)
        .populate('membership_id', 'name discount_percent points_per_session point_value redemption_threshold isActive');
    } catch (populateError) {
      // If populate fails, just get client without population
      console.warn('Populate failed, fetching without membership:', populateError.message);
      client = await Client.findById(req.params.id);
    }

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching client',
      error: error.message
    });
  }
};

// @desc    Create new client
// @route   POST /api/clients
// @access  Public
const createClient = async (req, res) => {
  try {
    console.log('createClient - Request body:', JSON.stringify(req.body, null, 2));
    
    // Helper function to convert empty strings to null
    const toNullIfEmpty = (value) => {
      if (value === undefined || value === null || value === '') return null;
      return value;
    };

    // Validate ObjectId format
    const isValidObjectId = (id) => {
      if (!id) return false;
      return mongoose.Types.ObjectId.isValid(id);
    };

    // Only name and phone are required, rest are optional
    const clientData = {
      name: req.body.name?.trim(),
      phone: req.body.phone?.trim(),
      email: toNullIfEmpty(req.body.email?.trim()),
      dob: toNullIfEmpty(req.body.dob),
      gender: toNullIfEmpty(req.body.gender),
      address: toNullIfEmpty(req.body.address?.trim()),
      notes: toNullIfEmpty(req.body.notes?.trim()),
      membership_id: req.body.membership_id && isValidObjectId(req.body.membership_id) 
        ? req.body.membership_id 
        : null,
      points_balance: req.body.points_balance !== undefined ? Number(req.body.points_balance) : 0,
      total_sessions: req.body.total_sessions !== undefined ? Number(req.body.total_sessions) : 0,
      rfid_number: toNullIfEmpty(req.body.rfid_number?.trim())
    };

    console.log('createClient - Processed data:', JSON.stringify(clientData, null, 2));

    const client = await Client.create(clientData);

    // Try to populate, but handle gracefully if MembershipTier model doesn't exist
    let populatedClient;
    try {
      populatedClient = await Client.findById(client._id)
        .populate('membership_id', 'name discount_percent points_per_session point_value redemption_threshold isActive');
    } catch (populateError) {
      console.warn('Populate failed, returning client without membership:', populateError.message);
      populatedClient = client;
    }

    res.status(201).json({
      success: true,
      data: populatedClient
    });
  } catch (error) {
    console.error('createClient - Error:', error);
    console.error('createClient - Error details:', {
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
      message: 'Error creating client',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update client
// @route   PUT /api/clients/:id
// @access  Public
const updateClient = async (req, res) => {
  try {
    console.log('updateClient - Request params:', req.params);
    console.log('updateClient - Request body:', JSON.stringify(req.body, null, 2));

    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Helper function to convert empty strings to null
    const toNullIfEmpty = (value) => {
      if (value === undefined || value === null || value === '') return null;
      return value;
    };

    // Validate ObjectId format
    const isValidObjectId = (id) => {
      if (!id) return false;
      return mongoose.Types.ObjectId.isValid(id);
    };

    // Update only provided fields
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name?.trim();
    if (req.body.phone !== undefined) updateData.phone = req.body.phone?.trim();
    if (req.body.email !== undefined) updateData.email = toNullIfEmpty(req.body.email?.trim());
    if (req.body.dob !== undefined) {
      // Convert date string to Date object if provided, otherwise null
      const dobValue = toNullIfEmpty(req.body.dob);
      updateData.dob = dobValue ? new Date(dobValue) : null;
    }
    if (req.body.gender !== undefined) updateData.gender = toNullIfEmpty(req.body.gender);
    if (req.body.address !== undefined) updateData.address = toNullIfEmpty(req.body.address?.trim());
    if (req.body.notes !== undefined) updateData.notes = toNullIfEmpty(req.body.notes?.trim());
    if (req.body.membership_id !== undefined) {
      updateData.membership_id = req.body.membership_id && isValidObjectId(req.body.membership_id)
        ? req.body.membership_id
        : null;
    }
    if (req.body.points_balance !== undefined) updateData.points_balance = Number(req.body.points_balance);
    if (req.body.total_sessions !== undefined) updateData.total_sessions = Number(req.body.total_sessions);
    if (req.body.rfid_number !== undefined) updateData.rfid_number = toNullIfEmpty(req.body.rfid_number?.trim());

    console.log('updateClient - Update data:', JSON.stringify(updateData, null, 2));

    // Update the client
    const updatedClient = await Client.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Try to populate, but handle gracefully if MembershipTier model doesn't exist
    let populatedClient;
    try {
      populatedClient = await Client.findById(updatedClient._id)
        .populate('membership_id', 'name discount_percent points_per_session point_value redemption_threshold isActive');
    } catch (populateError) {
      console.warn('Populate failed, returning client without membership:', populateError.message);
      populatedClient = updatedClient;
    }

    res.status(200).json({
      success: true,
      data: populatedClient
    });
  } catch (error) {
    console.error('updateClient - Error:', error);
    console.error('updateClient - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors,
      stack: error.stack
    });
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
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
      message: 'Error updating client',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete client
// @route   DELETE /api/clients/:id
// @access  Public
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    await Client.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting client',
      error: error.message
    });
  }
};

// @desc    Reset client sessions
// @route   POST /api/clients/:id/reset-sessions
// @access  Public (should be protected in production)
const resetClientSessions = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const sessionsReset = client.total_sessions || 0;

    // Create session reset log
    const resetLog = await SessionResetLog.create({
      clientId: client._id,
      sessionsReset: sessionsReset,
      resetBy: req.staff ? req.staff._id : null, // Set by protect middleware
      resetDate: new Date()
    });

    // Reset sessions to 0
    client.total_sessions = 0;
    await client.save();

    res.status(200).json({
      success: true,
      message: `Sessions reset successfully. ${sessionsReset} session(s) were reset.`,
      data: {
        client: {
          _id: client._id,
          name: client.name,
          total_sessions: client.total_sessions
        },
        resetLog: resetLog
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }
    console.error('resetClientSessions - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting client sessions',
      error: error.message
    });
  }
};

// @desc    Get client points history
// @route   GET /api/clients/:id/points-history
// @access  Public
const getClientPointsHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const client = await Client.findById(req.params.id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    const pointsHistory = await PointsHistory.find({ clientId: req.params.id })
      .populate('appointmentId', 'startTime serviceVariationId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const total = await PointsHistory.countDocuments({ clientId: req.params.id });

    res.status(200).json({
      success: true,
      data: {
        data: pointsHistory,
        pagination: {
          page: pageNumber,
          limit: limitNumber,
          total,
          pages: Math.ceil(total / limitNumber)
        }
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }
    console.error('getClientPointsHistory - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching points history',
      error: error.message
    });
  }
};

// @desc    Get client by RFID number
// @route   GET /api/clients/rfid/:rfidNumber
// @access  Public
const getClientByRFID = async (req, res) => {
  try {
    const { rfidNumber } = req.params;

    if (!rfidNumber || rfidNumber.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'RFID number is required'
      });
    }

    const client = await Client.findOne({ rfid_number: rfidNumber.trim() })
      .populate('membership_id', 'name discount_percent points_per_session point_value redemption_threshold isActive max_sessions_before_reset')
      .lean();

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found with this RFID number'
      });
    }

    res.status(200).json({
      success: true,
      data: client
    });
  } catch (error) {
    console.error('getClientByRFID - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching client by RFID',
      error: error.message
    });
  }
};

module.exports = {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  resetClientSessions,
  getClientPointsHistory,
  getClientByRFID
};

