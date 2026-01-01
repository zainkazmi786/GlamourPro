const mongoose = require('mongoose');
const ClientAuth = require('../models/ClientAuth');
const Client = require('../models/Client');

// @desc    Register client (only if they have membership)
// @route   POST /api/client-portal/register
// @access  Public
const registerClient = async (req, res) => {
  try {
    console.log('registerClient - Request received:', {
      method: req.method,
      path: req.path,
      body: { phone: req.body?.phone ? '***' : undefined, hasPassword: !!req.body?.password }
    });
    
    const { phone, password } = req.body;

    // Validate input
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find client by phone
    const client = await Client.findOne({ phone: phone.trim() });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found with this phone number'
      });
    }

    // Check if client has membership
    if (!client.membership_id) {
      return res.status(403).json({
        success: false,
        message: 'Only clients with active membership can register for portal access'
      });
    }

    // Check if auth already exists
    const existingAuth = await ClientAuth.findOne({ clientId: client._id });
    if (existingAuth) {
      return res.status(400).json({
        success: false,
        message: 'Account already exists. Please login instead.'
      });
    }

    // Check if phone is already used
    const existingPhoneAuth = await ClientAuth.findOne({ phone: phone.trim() });
    if (existingPhoneAuth) {
      return res.status(400).json({
        success: false,
        message: 'An account with this phone number already exists'
      });
    }

    // Create auth credentials
    const clientAuth = await ClientAuth.create({
      clientId: client._id,
      phone: phone.trim(),
      password: password,
      isActive: true
    });

    // Generate token
    const token = clientAuth.generateToken();

    // Fetch full client with populated membership
    const fullClient = await Client.findById(client._id)
      .populate('membership_id', 'name discount_percent points_per_session point_value redemption_threshold isActive max_sessions_before_reset');

    res.status(201).json({
      success: true,
      token,
      data: fullClient,
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('registerClient - Error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An account with this phone number or client already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error registering client',
      error: error.message
    });
  }
};

// @desc    Login client
// @route   POST /api/client-portal/login
// @access  Public
const loginClient = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Validate input
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required'
      });
    }

    // Find auth by phone (include password for comparison)
    const clientAuth = await ClientAuth.findOne({ phone: phone.trim() })
      .select('+password');

    if (!clientAuth) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    // Check if account is active
    if (!clientAuth.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact support.'
      });
    }

    // Check if client still has membership
    const client = await Client.findById(clientAuth.clientId);
    if (!client || !client.membership_id) {
      return res.status(403).json({
        success: false,
        message: 'Your membership is no longer active. Please contact support.'
      });
    }

    // Compare password
    const isPasswordValid = await clientAuth.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    // Generate token
    const token = clientAuth.generateToken();

    // Fetch full client with populated membership
    const fullClient = await Client.findById(client._id)
      .populate('membership_id', 'name discount_percent points_per_session point_value redemption_threshold isActive max_sessions_before_reset')
      .lean();

    res.status(200).json({
      success: true,
      token,
      data: fullClient,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('loginClient - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// @desc    Get client profile (protected)
// @route   GET /api/client-portal/profile
// @access  Private (client)
const getClientProfile = async (req, res) => {
  try {
    const clientId = req.client.id; // Set by clientAuth middleware

    const client = await Client.findById(clientId)
      .populate('membership_id', 'name discount_percent points_per_session point_value redemption_threshold isActive max_sessions_before_reset')
      .lean();

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
    console.error('getClientProfile - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

// @desc    Update client password
// @route   PUT /api/client-portal/password
// @access  Private (client)
const updateClientPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const clientId = req.client.id; // Set by clientAuth middleware

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Find auth
    const clientAuth = await ClientAuth.findOne({ clientId })
      .select('+password');

    if (!clientAuth) {
      return res.status(404).json({
        success: false,
        message: 'Authentication record not found'
      });
    }

    // Verify current password
    const isPasswordValid = await clientAuth.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    clientAuth.password = newPassword;
    await clientAuth.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('updateClientPassword - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};

module.exports = {
  registerClient,
  loginClient,
  getClientProfile,
  updateClientPassword
};
