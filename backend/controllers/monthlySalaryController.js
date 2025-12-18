const mongoose = require('mongoose');
const MonthlySalary = require('../models/MonthlySalary');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const CompanyClosure = require('../models/CompanyClosure');
const Staff = require('../models/Staff');

// Helper function to calculate working days in a month from attendance records
const calculateWorkingDaysInMonth = (attendanceRecords) => {
  // Count unique dates where staff had attendance records (any status)
  // This represents all days the staff was expected to work or did work
  const uniqueDates = new Set();
  
  attendanceRecords.forEach(record => {
    if (record.date) {
      const date = new Date(record.date);
      date.setHours(0, 0, 0, 0);
      const dateKey = date.toISOString().split('T')[0];
      uniqueDates.add(dateKey);
    }
  });
  
  return uniqueDates.size;
};

// Helper function to convert overtime hours to days
const convertOvertimeHoursToDays = (overtimeHours) => {
  if (overtimeHours >= 8) {
    return 1; // Full day
  } else if (overtimeHours >= 4) {
    return 0.5; // Half day
  }
  return 0;
};

// Helper function to convert short hours to deduction days
const convertShortHoursToDays = (shortHours) => {
  if (shortHours >= 8) {
    return 1; // Full day deduction
  } else if (shortHours >= 4) {
    return 0.5; // Half day deduction
  }
  return 0;
};

// @desc    Calculate monthly salary
// @route   POST /api/monthly-salary/calculate
// @access  Public
const calculateMonthlySalary = async (req, res) => {
  try {
    const { staffId, month, year, commission } = req.body;

    if (!staffId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID, month, and year are required'
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

    // Check if staff has daily wage set
    if (!staff.dailyWage || staff.dailyWage <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Staff member does not have a daily wage configured. Please set daily wage in staff profile.'
      });
    }

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get attendance records for the month
    const attendanceRecords = await Attendance.find({
      staffId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).lean();

    // Calculate actual working days (present days)
    const actualWorkingDays = attendanceRecords.filter(a => 
      a.status === 'present' || a.status === 'overtime'
    ).length;

    // Get leaves for the month
    const leaves = await Leave.find({
      staffId,
      status: 'approved',
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate }
        }
      ]
    }).lean();

    // Calculate paid and unpaid leaves taken in this month
    let paidLeavesTaken = 0;
    let unpaidLeavesTaken = 0;

    for (const leave of leaves) {
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      
      // Calculate overlapping days
      const overlapStart = leaveStart > startDate ? leaveStart : startDate;
      const overlapEnd = leaveEnd < endDate ? leaveEnd : endDate;
      
      if (overlapStart <= overlapEnd) {
        const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
        
        if (leave.type === 'paid') {
          paidLeavesTaken += overlapDays;
        } else {
          unpaidLeavesTaken += overlapDays;
        }
      }
    }

    // Get company closure days for the month
    const closures = await CompanyClosure.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).lean();

    const companyClosureDays = closures.length;

    // Calculate working days in month from attendance records
    // This counts all unique dates where staff has attendance records
    const workingDaysInMonth = calculateWorkingDaysInMonth(attendanceRecords);
    
    if (workingDaysInMonth === 0) {
      return res.status(400).json({
        success: false,
        message: 'No attendance records found for the specified month. Please import attendance data first.'
      });
    }

    // Calculate overtime and short days from attendance
    // For each day: calculate hours, then convert to days
    let totalOvertimeHours = 0;
    let totalShortHours = 0;
    
    attendanceRecords.forEach(record => {
      // Calculate working hours for this day
      let dayWorkingHours = 0;
      
      if (record.checkIn) {
        const checkInTime = new Date(record.checkIn);
        
        // If overtimeOut exists: (overtimeOut - checkIn), else (checkOut - checkIn)
        if (record.overtimeOut) {
          const overtimeTime = new Date(record.overtimeOut);
          dayWorkingHours = (overtimeTime - checkInTime) / (1000 * 60 * 60);
        } else if (record.checkOut) {
          const checkOutTime = new Date(record.checkOut);
          dayWorkingHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
        }
        
        // Standard working hours per day = 8 hours
        const standardHours = 8;
        
        if (dayWorkingHours > standardHours) {
          // Overtime hours
          totalOvertimeHours += (dayWorkingHours - standardHours);
        } else if (dayWorkingHours < standardHours) {
          // Short hours
          totalShortHours += (standardHours - dayWorkingHours);
        }
      }
    });
    
    // Convert overtime hours to days: 4+ extra hours = 0.5 day, 8+ extra hours = 1 full day
    const overtimeDays = convertOvertimeHoursToDays(totalOvertimeHours);
    
    // Convert short hours to deduction days: 4+ short hours = 0.5 day deduction, 8+ short hours = 1 full day deduction
    const shortDays = convertShortHoursToDays(totalShortHours);

    // Calculate base monthly salary from daily wage
    // Base Monthly Salary = Daily Wage × Working Days in Month
    const baseMonthlySalary = staff.dailyWage * workingDaysInMonth;
    
    // Calculate base daily salary
    // Base Daily Salary = Base Monthly Salary / Working Days in Month
    // This simplifies to: Base Daily Salary = Daily Wage
    const baseDailySalary = staff.dailyWage;

    // Calculate payable days
    const payableDays = actualWorkingDays + paidLeavesTaken + companyClosureDays;

    // Calculate deduction days
    const deductionDays = unpaidLeavesTaken + shortDays;

    // Calculate net salary
    const inputCommission = commission ? Number(commission) : 0;
    const netSalary = (payableDays - deductionDays) * baseDailySalary + inputCommission;

    // Create or update monthly salary record
    const salaryData = {
      staffId,
      month,
      year,
      baseDailySalary: Math.round(baseDailySalary * 100) / 100,
      actualWorkingDays,
      paidLeavesTaken,
      unpaidLeavesTaken,
      overtimeDays,
      shortDays,
      companyClosureDays,
      payableDays,
      deductionDays,
      netSalary: Math.round(netSalary * 100) / 100,
      commission: inputCommission,
      status: 'draft',
      // Store calculated values for reference
      baseMonthlySalary: Math.round(baseMonthlySalary * 100) / 100,
      workingDaysInMonth
    };

    const monthlySalary = await MonthlySalary.findOneAndUpdate(
      { staffId, month, year },
      salaryData,
      { new: true, upsert: true, runValidators: true }
    ).populate('staffId', 'name phone email').lean();

    res.status(200).json({
      success: true,
      data: monthlySalary
    });
  } catch (error) {
    console.error('calculateMonthlySalary - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating monthly salary',
      error: error.message
    });
  }
};

// @desc    Get all monthly salary records
// @route   GET /api/monthly-salary
// @access  Public
const getAllMonthlySalaries = async (req, res) => {
  try {
    const { staffId, month, year, status } = req.query;
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

    if (status) {
      query.status = status;
    }

    const salaries = await MonthlySalary.find(query)
      .populate('staffId', 'name phone email')
      .sort({ year: -1, month: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: salaries.length,
      data: salaries
    });
  } catch (error) {
    console.error('getAllMonthlySalaries - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly salaries',
      error: error.message
    });
  }
};

// @desc    Get monthly salary by ID
// @route   GET /api/monthly-salary/:id
// @access  Public
const getMonthlySalaryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid salary ID'
      });
    }

    const salary = await MonthlySalary.findById(id)
      .populate('staffId', 'name phone email')
      .lean();

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Monthly salary record not found'
      });
    }

    res.status(200).json({
      success: true,
      data: salary
    });
  } catch (error) {
    console.error('getMonthlySalaryById - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly salary',
      error: error.message
    });
  }
};

// @desc    Get monthly salaries for specific staff
// @route   GET /api/monthly-salary/staff/:staffId
// @access  Public
const getMonthlySalariesByStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { year } = req.query;

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

    const salaries = await MonthlySalary.find(query)
      .populate('staffId', 'name phone email')
      .sort({ year: -1, month: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: salaries.length,
      data: salaries
    });
  } catch (error) {
    console.error('getMonthlySalariesByStaff - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly salaries',
      error: error.message
    });
  }
};

// @desc    Update monthly salary
// @route   PUT /api/monthly-salary/:id
// @access  Public
const updateMonthlySalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { commission, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid salary ID'
      });
    }

    const salary = await MonthlySalary.findById(id);
    if (!salary) {
      return res.status(404).json({
        success: false,
        message: 'Monthly salary record not found'
      });
    }

    const updateData = {};
    if (commission !== undefined) {
      updateData.commission = Number(commission);
      // Recalculate net salary with new commission
      const netSalary = (salary.payableDays - salary.deductionDays) * salary.baseDailySalary + Number(commission);
      updateData.netSalary = Math.round(netSalary * 100) / 100;
    }
    if (status !== undefined) {
      updateData.status = status;
    }

    const updatedSalary = await MonthlySalary.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('staffId', 'name phone email').lean();

    res.status(200).json({
      success: true,
      data: updatedSalary
    });
  } catch (error) {
    console.error('updateMonthlySalary - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating monthly salary',
      error: error.message
    });
  }
};

// @desc    Bulk delete monthly salaries
// @route   DELETE /api/monthly-salary/bulk
// @access  Public
const bulkDeleteMonthlySalaries = async (req, res) => {
  try {
    const { ids } = req.body; // Array of salary record IDs

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of salary record IDs is required'
      });
    }

    // Validate all IDs are valid ObjectIds
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid salary record IDs provided'
      });
    }

    const result = await MonthlySalary.deleteMany({ _id: { $in: validIds } });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} salary record(s)`,
      data: {
        deletedCount: result.deletedCount,
        requestedCount: ids.length,
        validCount: validIds.length
      }
    });
  } catch (error) {
    console.error('bulkDeleteMonthlySalaries - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting salary records',
      error: error.message
    });
  }
};

module.exports = {
  calculateMonthlySalary,
  getAllMonthlySalaries,
  getMonthlySalaryById,
  getMonthlySalariesByStaff,
  updateMonthlySalary,
  bulkDeleteMonthlySalaries
};
