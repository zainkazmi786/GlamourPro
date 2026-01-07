const Staff = require('../models/Staff');

// @desc    Staff login
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Validate input
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone and password'
      });
    }

    // Find staff by phone and include password (since select: false by default)
    const staff = await Staff.findOne({ phone }).select('+password');

    if (!staff) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if staff is active
    if (staff.status !== 'Active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please contact administrator.'
      });
    }

    // Compare password
    const isPasswordMatch = await staff.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = staff.generateToken();

    // Remove password from staff object
    const staffData = staff.toObject();
    delete staffData.password;

    res.status(200).json({
      success: true,
      token,
      data: staffData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// @desc    Get current logged-in staff
// @route   GET /api/auth/me
// @access  Protected (will be protected with middleware later)
const getMe = async (req, res) => {
  try {
    // Staff is attached to request by protect middleware
    const staff = await Staff.findById(req.staff.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    res.status(200).json({
      success: true,
      data: staff
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: error.message
    });
  }
};

// @desc    Update staff password
// @route   PUT /api/auth/update-password
// @access  Protected (will be protected with middleware later)
const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current password and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters'
      });
    }

    // Find staff with password
    const staff = await Staff.findById(req.staff.id).select('+password');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Verify current password
    const isPasswordMatch = await staff.comparePassword(currentPassword);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password (will be hashed by pre-save hook)
    staff.password = newPassword;
    await staff.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password',
      error: error.message
    });
  }
};

// @desc    Forgot password - verify email and phone
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { email, phone } = req.body;

    // Validate input
    if (!email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and phone number'
      });
    }

    // Find staff by email and phone
    const staff = await Staff.findOne({ 
      email: email.toLowerCase().trim(),
      phone: phone.trim()
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'No account found with the provided email and phone number'
      });
    }

    // Check if staff is active
    if (staff.status !== 'Active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please contact administrator.'
      });
    }

    // Return success (in a real app, you would send a reset token via email)
    // For now, we'll just verify and allow password reset
    res.status(200).json({
      success: true,
      message: 'Email and phone verified. You can now reset your password.',
      staffId: staff._id
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing forgot password request',
      error: error.message
    });
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { email, phone, newPassword } = req.body;

    // Validate input
    if (!email || !phone || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, phone number, and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Find staff by email and phone
    const staff = await Staff.findOne({ 
      email: email.toLowerCase().trim(),
      phone: phone.trim()
    }).select('+password');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'No account found with the provided email and phone number'
      });
    }

    // Check if staff is active
    if (staff.status !== 'Active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please contact administrator.'
      });
    }

    // Update password (will be hashed by pre-save hook)
    staff.password = newPassword;
    await staff.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

module.exports = {
  login,
  getMe,
  updatePassword,
  forgotPassword,
  resetPassword
};







