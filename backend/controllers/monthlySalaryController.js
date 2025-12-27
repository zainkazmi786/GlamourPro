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

    // Separate attendance records by status
    const presentRecords = attendanceRecords.filter(a => a.status === 'present');
    const overtimeRecords = attendanceRecords.filter(a => a.status === 'overtime');
    const halfDayRecords = attendanceRecords.filter(a => a.status === 'half-day');
    const absentRecords = attendanceRecords.filter(a => a.status === 'absent');
    
    // Calculate working days components:
    // A = Count of days with status 'present' (each = 1 day)
    const A = presentRecords.length;
    
    // B = Count of days with status 'overtime' (each = 1 day)
    const B = overtimeRecords.length;
    
    // X = Sum of workingHours from 'half-day' records / 8
    // Example: 3 half-days with 4 hours each = 12 hours / 8 = 1.5 working days
    const totalHalfDayHours = halfDayRecords.reduce((sum, record) => {
      const hours = record.workingHours || 0;
      if (isNaN(hours) || hours < 0) {
        console.warn(`Invalid workingHours in half-day record: ${hours}`);
        return sum;
      }
      return sum + hours;
    }, 0);
    const X = totalHalfDayHours > 0 ? totalHalfDayHours / 8 : 0;
    
    // Y = Sum of overtimeHours from 'overtime' records / 8 (additional days)
    // Example: 3 days with 4 overtime hours each = 12 hours / 8 = 1.5 additional working days
    // These 3 days already count as 3 days (B), so total = 3 + 1.5 = 4.5 working days
    const totalOvertimeBonusHours = overtimeRecords.reduce((sum, record) => {
      const hours = record.overtimeHours || 0;
      if (isNaN(hours) || hours < 0) {
        console.warn(`Invalid overtimeHours in overtime record: ${hours}`);
        return sum;
      }
      return sum + hours;
    }, 0);
    const Y = totalOvertimeBonusHours > 0 ? totalOvertimeBonusHours / 8 : 0;
    
    // Actual Working Days = A + B + X + Y
    const actualWorkingDays = Math.max(0, A + B + X + Y); // Ensure non-negative
    
    console.log(`Working Days Calculation:
      - Present days (A): ${A}
      - Overtime days (B): ${B}
      - Half-days converted (X): ${X.toFixed(2)} (from ${totalHalfDayHours.toFixed(2)} hours)
      - Overtime bonus days (Y): ${Y.toFixed(2)} (from ${totalOvertimeBonusHours.toFixed(2)} hours)
      - Total Actual Working Days: ${actualWorkingDays.toFixed(2)}`);

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

    // Calculate short hours only from records with workingHours < 7.5
    // This includes half-days and absent records
    // Note: Half-days are already converted to working days (X), but we still need to calculate
    // short hours for deduction purposes based on the shortfall from 8 hours
    let totalShortHours = 0;
    const minimumPresentHours = 7.5;
    const standardHours = 8;
    
    // Calculate short hours from records that worked less than 7.5 hours
    // (half-days and absent records)
    const shortTimeRecords = [...halfDayRecords, ...absentRecords];
    shortTimeRecords.forEach(record => {
      const workingHours = record.workingHours || 0;
      if (workingHours > 0 && workingHours < minimumPresentHours) {
        // Short hours = difference from standard 8 hours
        const shortHoursForDay = standardHours - workingHours;
        if (shortHoursForDay > 0) {
          totalShortHours += shortHoursForDay;
        }
      }
    });
    
    // Convert short hours to deduction days: 4+ short hours = 0.5 day deduction, 8+ short hours = 1 full day deduction
    const shortDays = convertShortHoursToDays(totalShortHours);
    
    // Overtime days are already accounted for in Y (overtime bonus days)
    // This represents the additional working days from overtime hours
    const overtimeDays = Y; // Overtime bonus days from calculation above
    
    console.log(`Short Hours Calculation:
      - Total short hours: ${totalShortHours.toFixed(2)}
      - Short days (deduction): ${shortDays.toFixed(2)}
      - Overtime bonus days: ${overtimeDays.toFixed(2)}`);

    // Calculate base monthly salary from daily wage
    // Base Monthly Salary = Daily Wage × Working Days in Month
    const baseMonthlySalary = staff.dailyWage * workingDaysInMonth;
    
    // Calculate base daily salary
    // Base Daily Salary = Base Monthly Salary / Working Days in Month
    // This simplifies to: Base Daily Salary = Daily Wage
    const baseDailySalary = staff.dailyWage;

    // Calculate net salary
    // Ensure netSalary is never negative (minimum 0)
    const inputCommission = commission ? Number(commission) : 0;
    
    // Calculate payable days
    // Payable Days = Actual Working Days + Paid Leaves + Company Closure Days
    const payableDays = actualWorkingDays + paidLeavesTaken + companyClosureDays;

    // Calculate deduction days
    // Deduction Days = Unpaid Leaves + Short Days (converted)
    const deductionDays = unpaidLeavesTaken + shortDays;
    
    console.log(`Salary Calculation Summary:
      - Actual Working Days: ${actualWorkingDays.toFixed(2)}
      - Paid Leaves: ${paidLeavesTaken}
      - Company Closure Days: ${companyClosureDays}
      - Payable Days: ${payableDays.toFixed(2)}
      - Unpaid Leaves: ${unpaidLeavesTaken}
      - Short Days: ${shortDays.toFixed(2)}
      - Deduction Days: ${deductionDays.toFixed(2)}
      - Base Daily Salary: ${baseDailySalary.toFixed(2)}
      - Commission: ${inputCommission.toFixed(2)}`);
    const calculatedSalary = (payableDays - deductionDays) * baseDailySalary + inputCommission;
    const netSalary = Math.max(0, calculatedSalary); // Ensure minimum is 0

    // Create or update monthly salary record
    const salaryData = {
      staffId,
      month,
      year,
      baseDailySalary: Math.round(baseDailySalary * 100) / 100,
      actualWorkingDays: Math.round(actualWorkingDays * 100) / 100, // Round to 2 decimal places
      paidLeavesTaken,
      unpaidLeavesTaken,
      overtimeDays: Math.round(overtimeDays * 100) / 100, // Overtime bonus days
      shortDays: Math.round(shortDays * 100) / 100,
      companyClosureDays,
      payableDays: Math.round(payableDays * 100) / 100,
      deductionDays: Math.round(deductionDays * 100) / 100,
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
      const calculatedSalary = (salary.payableDays - salary.deductionDays) * salary.baseDailySalary + Number(commission);
      const netSalary = Math.max(0, calculatedSalary); // Ensure minimum is 0
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
