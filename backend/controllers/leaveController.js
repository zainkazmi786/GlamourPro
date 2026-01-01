const mongoose = require('mongoose');
const Leave = require('../models/Leave');
const Staff = require('../models/Staff');

// @desc    Create leave request
// @route   POST /api/leaves
// @access  Public
const createLeave = async (req, res) => {
  try {
    const { staffId, startDate, endDate, type, reason } = req.body;

    if (!staffId || !startDate || !endDate || !type) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID, start date, end date, and type are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Calculate days (including both start and end dates)
    const diffTime = Math.abs(end - start);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const year = start.getFullYear();

    // Check paid leave quota if type is paid
    if (type === 'paid') {
      const existingPaidLeaves = await Leave.find({
        staffId,
        type: 'paid',
        status: 'approved',
        year
      });

      const usedQuota = existingPaidLeaves.reduce((sum, leave) => sum + leave.days, 0);
      const availableQuota = staff.annualPaidLeavesQuota - usedQuota;

      if (days > availableQuota) {
        return res.status(400).json({
          success: false,
          message: `Insufficient paid leave quota. Available: ${availableQuota} days, Requested: ${days} days`
        });
      }
    }

    // Create leave with days explicitly set (pre-save hook will also calculate it, but this ensures it's set for validation)
    const leave = await Leave.create({
      staffId,
      startDate: start,
      endDate: end,
      type,
      reason: reason || null,
      days, // Explicitly set days to satisfy required validation
      year
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate('staffId', 'name phone email')
      .lean();

    res.status(201).json({
      success: true,
      data: populatedLeave
    });
  } catch (error) {
    console.error('createLeave - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating leave request',
      error: error.message
    });
  }
};

// @desc    Get all leaves
// @route   GET /api/leaves
// @access  Public
const getAllLeaves = async (req, res) => {
  try {
    const { staffId, type, year, status } = req.query;
    let query = {};

    if (staffId) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid staff ID'
        });
      }
      query.staffId = staffId;
    }

    if (type) {
      query.type = type;
    }

    if (year) {
      query.year = parseInt(year);
    }

    if (status) {
      query.status = status;
    }

    const leaves = await Leave.find(query)
      .populate('staffId', 'name phone email')
      .sort({ startDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    console.error('getAllLeaves - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leaves',
      error: error.message
    });
  }
};

// @desc    Get leaves for specific staff
// @route   GET /api/leaves/staff/:staffId
// @access  Public
const getLeavesByStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { year, type } = req.query;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    let query = { staffId };

    if (year) {
      query.year = parseInt(year);
    }

    if (type) {
      query.type = type;
    }

    const leaves = await Leave.find(query)
      .populate('staffId', 'name phone email')
      .sort({ startDate: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: leaves.length,
      data: leaves
    });
  } catch (error) {
    console.error('getLeavesByStaff - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leaves',
      error: error.message
    });
  }
};

// @desc    Get leave quota for staff
// @route   GET /api/leaves/quota/:staffId
// @access  Public
const getLeaveQuota = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { year } = req.query;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const paidLeaves = await Leave.find({
      staffId,
      type: 'paid',
      status: 'approved',
      year: currentYear
    });

    const usedQuota = paidLeaves.reduce((sum, leave) => sum + leave.days, 0);
    const totalQuota = staff.annualPaidLeavesQuota || 12;
    const remainingQuota = totalQuota - usedQuota;

    res.status(200).json({
      success: true,
      data: {
        totalQuota,
        usedQuota,
        remainingQuota,
        year: currentYear
      }
    });
  } catch (error) {
    console.error('getLeaveQuota - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching leave quota',
      error: error.message
    });
  }
};

// @desc    Update leave
// @route   PUT /api/leaves/:id
// @access  Public
const updateLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, type, reason, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave ID'
      });
    }

    const leave = await Leave.findById(id);
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    const updateData = {};
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = new Date(endDate);
    if (type !== undefined) updateData.type = type;
    if (reason !== undefined) updateData.reason = reason;
    if (status !== undefined) updateData.status = status;

    // Recalculate days if dates changed
    if (updateData.startDate || updateData.endDate) {
      const start = updateData.startDate || leave.startDate;
      const end = updateData.endDate || leave.endDate;
      const diffTime = Math.abs(end - start);
      updateData.days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      updateData.year = new Date(start).getFullYear();
    }

    // Validate paid leave quota if approving paid leave
    if (status === 'approved' && (leave.type === 'paid' || type === 'paid')) {
      const staff = await Staff.findById(leave.staffId);
      const leaveType = type || leave.type;
      const leaveYear = updateData.year || leave.year;
      const leaveDays = updateData.days || leave.days;

      if (leaveType === 'paid') {
        const existingPaidLeaves = await Leave.find({
          staffId: leave.staffId,
          type: 'paid',
          status: 'approved',
          year: leaveYear,
          _id: { $ne: id } // Exclude current leave
        });

        const usedQuota = existingPaidLeaves.reduce((sum, l) => sum + l.days, 0);
        const availableQuota = staff.annualPaidLeavesQuota - usedQuota;

        if (leaveDays > availableQuota) {
          return res.status(400).json({
            success: false,
            message: `Insufficient paid leave quota. Available: ${availableQuota} days, Requested: ${leaveDays} days`
          });
        }
      }
    }

    const updatedLeave = await Leave.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true
    }).populate('staffId', 'name phone email').lean();

    res.status(200).json({
      success: true,
      data: updatedLeave
    });
  } catch (error) {
    console.error('updateLeave - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating leave',
      error: error.message
    });
  }
};

// @desc    Delete leave
// @route   DELETE /api/leaves/:id
// @access  Public
const deleteLeave = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid leave ID'
      });
    }

    const leave = await Leave.findByIdAndDelete(id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Leave request deleted successfully'
    });
  } catch (error) {
    console.error('deleteLeave - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting leave',
      error: error.message
    });
  }
};

module.exports = {
  createLeave,
  getAllLeaves,
  getLeavesByStaff,
  getLeaveQuota,
  updateLeave,
  deleteLeave
};







