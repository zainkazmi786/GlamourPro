const mongoose = require('mongoose');
const Staff = require('../models/Staff');

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Public
const getAllStaff = async (req, res) => {
  try {
    console.log('getAllStaff - Query params:', req.query);
    const { search, phone } = req.query;
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

    const staff = await Staff.find(query)
      .select('name phone email hireDate referralCommission paidLeaves specialization status dailyWage createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean(); // Use lean() for better performance and to ensure all fields are included

    console.log(`getAllStaff - Found ${staff.length} staff members`);
    
    // Log first staff member to verify data structure
    if (staff.length > 0) {
      console.log('Sample staff member:', JSON.stringify(staff[0], null, 2));
    }

    res.status(200).json({
      success: true,
      count: staff.length,
      data: staff
    });
  } catch (error) {
    console.error('getAllStaff - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching staff',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get single staff member by ID
// @route   GET /api/staff/:id
// @access  Public
const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.status(200).json({
      success: true,
      data: staff
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching staff member',
      error: error.message
    });
  }
};

// @desc    Create new staff member
// @route   POST /api/staff
// @access  Public
const createStaff = async (req, res) => {
  try {
    console.log('createStaff - Request body:', JSON.stringify(req.body, null, 2));
    
    // Prevent creating manager role via form
    if (req.body.role === 'manager') {
      return res.status(400).json({
        success: false,
        message: 'Manager role cannot be created via form. Please use seed script.'
      });
    }

    // Helper function to convert empty strings to null
    const toNullIfEmpty = (value) => {
      if (value === undefined || value === null || value === '') return null;
      return value;
    };

    // Prepare staff data
    const staffData = {
      name: req.body.name?.trim(),
      phone: req.body.phone?.trim(),
      email: toNullIfEmpty(req.body.email?.trim()),
      password: req.body.password, // Will be hashed by pre-save hook
      role: req.body.role || 'therapist', // Default to therapist, prevent manager
      hireDate: req.body.hireDate ? new Date(req.body.hireDate) : null,
      referralCommission: req.body.referralCommission !== undefined ? Number(req.body.referralCommission) : 0,
      paidLeaves: req.body.paidLeaves !== undefined ? Number(req.body.paidLeaves) : 0,
      specialization: req.body.specialization,
      status: req.body.status || 'Active',
      dailyWage: req.body.dailyWage !== undefined ? Number(req.body.dailyWage) : 0
    };

    // Ensure role is not manager
    if (staffData.role === 'manager') {
      staffData.role = 'therapist';
    }

    console.log('createStaff - Processed data:', JSON.stringify({ ...staffData, password: '***' }, null, 2));

    const staff = await Staff.create(staffData);

    // Remove password from response (should be automatic with select: false, but be explicit)
    const staffResponse = staff.toObject();
    delete staffResponse.password;

    res.status(201).json({
      success: true,
      data: staffResponse
    });
  } catch (error) {
    console.error('createStaff - Error:', error);
    console.error('createStaff - Error details:', {
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
      message: 'Error creating staff member',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update staff member
// @route   PUT /api/staff/:id
// @access  Public
const updateStaff = async (req, res) => {
  try {
    console.log('updateStaff - Request params:', req.params);
    console.log('updateStaff - Request body:', JSON.stringify(req.body, null, 2));

    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Prevent role change to/from manager via form
    if (req.body.role === 'manager' || (req.body.role && staff.role === 'manager' && req.body.role !== 'manager')) {
      return res.status(400).json({
        success: false,
        message: 'Manager role cannot be changed via form. Please use seed script or database directly.'
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
    if (req.body.phone !== undefined) updateData.phone = req.body.phone?.trim();
    if (req.body.email !== undefined) updateData.email = toNullIfEmpty(req.body.email?.trim());
    if (req.body.password !== undefined && req.body.password !== '') {
      updateData.password = req.body.password; // Will be hashed by pre-save hook
    }
    if (req.body.role !== undefined && req.body.role !== 'manager') {
      updateData.role = req.body.role;
    }
    if (req.body.hireDate !== undefined) {
      updateData.hireDate = req.body.hireDate ? new Date(req.body.hireDate) : null;
    }
    if (req.body.referralCommission !== undefined) {
      updateData.referralCommission = Number(req.body.referralCommission);
    }
    if (req.body.paidLeaves !== undefined) {
      updateData.paidLeaves = Number(req.body.paidLeaves);
    }
    if (req.body.specialization !== undefined) updateData.specialization = req.body.specialization;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.dailyWage !== undefined) {
      updateData.dailyWage = Number(req.body.dailyWage);
    }

    console.log('updateStaff - Update data:', JSON.stringify({ ...updateData, password: updateData.password ? '***' : undefined }, null, 2));

    const updatedStaff = await Staff.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Remove password from response
    const staffResponse = updatedStaff.toObject();
    delete staffResponse.password;

    res.status(200).json({
      success: true,
      data: staffResponse
    });
  } catch (error) {
    console.error('updateStaff - Error:', error);
    console.error('updateStaff - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors,
      stack: error.stack
    });
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
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
      message: 'Error updating staff member',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update staff status only
// @route   PATCH /api/staff/:id/status
// @access  Public
const updateStaffStatus = async (req, res) => {
  try {
    console.log('updateStaffStatus - Request params:', req.params);
    console.log('updateStaffStatus - Request body:', JSON.stringify(req.body, null, 2));

    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Validate status
    const validStatuses = ['Active', 'Terminated', 'Resigned', 'On Leave'];
    if (!req.body.status || !validStatuses.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: Active, Terminated, Resigned, On Leave'
      });
    }

    const updatedStaff = await Staff.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedStaff,
      message: `Status updated to ${req.body.status}`
    });
  } catch (error) {
    console.error('updateStaffStatus - Error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating staff status',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete staff member
// @route   DELETE /api/staff/:id
// @access  Public
const deleteStaff = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Prevent deleting manager role
    if (staff.role === 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Manager role cannot be deleted. Please contact system administrator.'
      });
    }

    await Staff.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Staff member deleted successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting staff member',
      error: error.message
    });
  }
};

module.exports = {
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  updateStaffStatus,
  deleteStaff
};

// Export getChatUsers if needed (it's in chatController)
// This is handled in chatRoutes


