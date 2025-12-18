const mongoose = require('mongoose');
const MonthlySalaryConfig = require('../models/MonthlySalaryConfig');
const Staff = require('../models/Staff');

// @desc    Create or update monthly salary config
// @route   POST /api/monthly-salary-config
// @access  Public
const createOrUpdateConfig = async (req, res) => {
  try {
    const { staffId, month, year, baseMonthlySalary, workingDaysInMonth } = req.body;

    if (!staffId || !month || !year || baseMonthlySalary === undefined || !workingDaysInMonth) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID, month, year, base monthly salary, and working days are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: 'Month must be between 1 and 12'
      });
    }

    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const config = await MonthlySalaryConfig.findOneAndUpdate(
      { staffId, month, year },
      {
        staffId,
        month,
        year,
        baseMonthlySalary: Number(baseMonthlySalary),
        workingDaysInMonth: Number(workingDaysInMonth)
      },
      { new: true, upsert: true, runValidators: true }
    ).populate('staffId', 'name phone email').lean();

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('createOrUpdateConfig - Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Configuration already exists for this staff, month, and year'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating/updating salary config',
      error: error.message
    });
  }
};

// @desc    Get all monthly salary configs
// @route   GET /api/monthly-salary-config
// @access  Public
const getAllConfigs = async (req, res) => {
  try {
    const { staffId, month, year } = req.query;
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

    if (month) {
      query.month = parseInt(month);
    }

    if (year) {
      query.year = parseInt(year);
    }

    const configs = await MonthlySalaryConfig.find(query)
      .populate('staffId', 'name phone email')
      .sort({ year: -1, month: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (error) {
    console.error('getAllConfigs - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary configs',
      error: error.message
    });
  }
};

// @desc    Get config for specific staff
// @route   GET /api/monthly-salary-config/staff/:staffId
// @access  Public
const getConfigByStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { month, year } = req.query;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    let query = { staffId };

    if (month) {
      query.month = parseInt(month);
    }

    if (year) {
      query.year = parseInt(year);
    }

    const configs = await MonthlySalaryConfig.find(query)
      .populate('staffId', 'name phone email')
      .sort({ year: -1, month: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (error) {
    console.error('getConfigByStaff - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching salary config',
      error: error.message
    });
  }
};

module.exports = {
  createOrUpdateConfig,
  getAllConfigs,
  getConfigByStaff
};
