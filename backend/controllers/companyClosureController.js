const mongoose = require('mongoose');
const CompanyClosure = require('../models/CompanyClosure');

// @desc    Add company closure day
// @route   POST /api/company-closures
// @access  Public
const createClosure = async (req, res) => {
  try {
    const { date, reason, isHoliday } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    const closureDate = new Date(date);
    if (isNaN(closureDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Normalize date to start of day
    closureDate.setHours(0, 0, 0, 0);

    const closure = await CompanyClosure.create({
      date: closureDate,
      reason: reason || null,
      isHoliday: isHoliday || false
    });

    res.status(201).json({
      success: true,
      data: closure
    });
  } catch (error) {
    console.error('createClosure - Error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Closure already exists for this date'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating company closure',
      error: error.message
    });
  }
};

// @desc    Get all company closures
// @route   GET /api/company-closures
// @access  Public
const getAllClosures = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const closures = await CompanyClosure.find(query)
      .sort({ date: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: closures.length,
      data: closures
    });
  } catch (error) {
    console.error('getAllClosures - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching company closures',
      error: error.message
    });
  }
};

// @desc    Delete company closure
// @route   DELETE /api/company-closures/:id
// @access  Public
const deleteClosure = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid closure ID'
      });
    }

    const closure = await CompanyClosure.findByIdAndDelete(id);

    if (!closure) {
      return res.status(404).json({
        success: false,
        message: 'Company closure not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Company closure deleted successfully'
    });
  } catch (error) {
    console.error('deleteClosure - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting company closure',
      error: error.message
    });
  }
};

module.exports = {
  createClosure,
  getAllClosures,
  deleteClosure
};






