const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Staff = require('../models/Staff');
const csv = require('csv-parser');
const { Readable } = require('stream');

// @desc    Import attendance from CSV
// @route   POST /api/attendance/import
// @access  Public
const importAttendance = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is required'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
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

    // Normalize start and end dates to start of day for inclusive comparison
    const startNormalized = new Date(start);
    startNormalized.setHours(0, 0, 0, 0);
    
    const endNormalized = new Date(end);
    endNormalized.setHours(23, 59, 59, 999); // End of day to include all records on end date
    
    console.log(`Date range (inclusive): ${startNormalized.toISOString()} to ${endNormalized.toISOString()}`);

    // Parse CSV file
    const csvData = [];
    const stream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (csvData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV file is empty'
      });
    }

    // Process attendance data
    const attendanceMap = new Map(); // Key: biometric_emp_id_date, Value: attendance data
    const errors = [];
    const skipped = [];
    let processed = 0;
    let rowNumber = 0;

    console.log(`\n=== ATTENDANCE IMPORT DEBUG ===`);
    console.log(`Total CSV rows: ${csvData.length}`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    console.log(`\nProcessing rows...\n`);

    // Group by biometric_emp_id and date, and process states
    for (const row of csvData) {
      rowNumber++;
      
      // Extract values - iterate over keys to find the correct column names
      // This handles any potential issues with property access
      let empId = null;
      let timeStr = null;
      let stateStr = null;
      let deviceName = null;
      
      // Iterate over all keys to find matching columns
      for (const key of Object.keys(row)) {
        const value = row[key];
        if (value == null) continue;
        
        const keyLower = key.toLowerCase().trim();
        const valueStr = String(value).trim();
        
        if (keyLower.includes('emp') && keyLower.includes('id')) {
          empId = valueStr;
        } else if (keyLower === 'time') {
          timeStr = valueStr;
        } else if (keyLower.includes('attendance') && keyLower.includes('state')) {
          stateStr = valueStr;
        } else if (keyLower.includes('device') && keyLower.includes('name')) {
          deviceName = valueStr;
        }
      }
      
      const state = stateStr ? parseInt(stateStr) : NaN;

      // Debug: Log raw row data if Emp ID is missing
      if (!empId && rowNumber <= 3) {
        console.log(`\nRow ${rowNumber} raw data:`, JSON.stringify(row, null, 2));
        console.log(`Row ${rowNumber} keys:`, Object.keys(row));
        console.log(`Row ${rowNumber} - Direct access test:`, {
          'row["Emp ID"]': row['Emp ID'],
          'typeof row["Emp ID"]': typeof row['Emp ID'],
          'row.hasOwnProperty("Emp ID")': row.hasOwnProperty('Emp ID'),
          'Object.keys(row).includes("Emp ID")': Object.keys(row).includes('Emp ID'),
          'empId after processing': empId
        });
      }

      console.log(`Row ${rowNumber}: Emp ID=${empId}, Time=${timeStr}, State=${state}, Device=${deviceName}`);

      if (!empId || empId === 'undefined' || !timeStr || timeStr === 'undefined') {
        const errorMsg = `Row ${rowNumber}: Invalid row - Missing Emp ID or Time (Emp ID: "${empId}", Time: "${timeStr}")`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }

      // Parse date from time string (format: MM/DD/YYYY HH:MM:SS)
      const timeParts = timeStr.split(' ');
      if (timeParts.length < 2) {
        const errorMsg = `Row ${rowNumber}: Invalid time format - Expected "MM/DD/YYYY HH:MM:SS", got "${timeStr}"`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }

      const dateStr = timeParts[0];
      const timeOnly = timeParts[1];
      const [month, day, year] = dateStr.split('/');
      
      if (!month || !day || !year) {
        const errorMsg = `Row ${rowNumber}: Invalid date format - Could not parse date from "${dateStr}"`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }

      const attendanceDate = new Date(`${year}-${month}-${day}`);
      
      if (isNaN(attendanceDate.getTime())) {
        const errorMsg = `Row ${rowNumber}: Invalid date - Could not create date from "${year}-${month}-${day}"`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }
      
      // Normalize date to start of day for comparison
      const normalizedDate = new Date(attendanceDate);
      normalizedDate.setHours(0, 0, 0, 0);
      
      // Check if date is within range (inclusive: >= start and <= end)
      if (normalizedDate < startNormalized || normalizedDate > endNormalized) {
        const skipMsg = `Row ${rowNumber}: Date ${dateStr} is outside the specified range (${startDate} to ${endDate})`;
        console.log(`  ⏭️  ${skipMsg}`);
        skipped.push(skipMsg);
        continue;
      }

      const key = `${empId}_${normalizedDate.toISOString()}`;

      if (!attendanceMap.has(key)) {
        attendanceMap.set(key, {
          biometric_emp_id: empId,
          date: normalizedDate,
          deviceName: deviceName || null,
          checkIn: null,
          checkOut: null,
          overtimeOut: null,
          states: []
        });
      }

      const attendance = attendanceMap.get(key);
      const fullDateTime = new Date(`${year}-${month}-${day}T${timeOnly}`);
      
      if (isNaN(fullDateTime.getTime())) {
        const errorMsg = `Row ${rowNumber}: Invalid datetime - Could not create datetime from "${year}-${month}-${day}T${timeOnly}"`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }

      // Process states: 0 = check-in, 1 = check-out, 5 = overtime-out
      if (state === 0) {
        if (!attendance.checkIn || fullDateTime < attendance.checkIn) {
          attendance.checkIn = fullDateTime;
          console.log(`  ✓ Check-in recorded: ${fullDateTime.toISOString()}`);
        }
      } else if (state === 1) {
        if (!attendance.checkOut || fullDateTime > attendance.checkOut) {
          attendance.checkOut = fullDateTime;
          console.log(`  ✓ Check-out recorded: ${fullDateTime.toISOString()}`);
        }
      } else if (state === 5) {
        if (!attendance.overtimeOut || fullDateTime > attendance.overtimeOut) {
          attendance.overtimeOut = fullDateTime;
          console.log(`  ✓ Overtime-out recorded: ${fullDateTime.toISOString()}`);
        }
      } else {
        const errorMsg = `Row ${rowNumber}: Unknown attendance state "${state}" (expected 0, 1, or 5)`;
        console.warn(`  ⚠️  ${errorMsg}`);
        errors.push(errorMsg);
      }

      attendance.states.push({ state, time: fullDateTime });
    }

    // Find staff members by biometric_emp_id
    const biometricIds = [...new Set(Array.from(attendanceMap.keys()).map(k => k.split('_')[0]))];
    console.log(`\n=== STAFF LOOKUP ===`);
    console.log(`Unique biometric IDs found in CSV: ${biometricIds.join(', ')}`);
    
    const staffMembers = await Staff.find({ biometric_emp_id: { $in: biometricIds } });
    console.log(`Staff members found in database: ${staffMembers.length}`);
    staffMembers.forEach(s => {
      console.log(`  - Biometric ID: "${s.biometric_emp_id}" (as string), Staff: ${s.name} (ID: ${s._id})`);
    });
    
    const staffMap = new Map(staffMembers.map(s => [s.biometric_emp_id, s]));
    
    // Check for missing staff
    const missingStaffIds = biometricIds.filter(id => !staffMap.has(id));
    if (missingStaffIds.length > 0) {
      console.error(`\n⚠️  Missing staff for biometric IDs: ${missingStaffIds.join(', ')}`);
      console.error(`   Make sure these biometric IDs exist in the Staff collection with matching biometric_emp_id values.`);
    }

    // Process and save attendance records
    const attendanceRecords = [];
    const duplicateChecks = [];

    console.log(`\n=== PROCESSING ATTENDANCE RECORDS ===`);
    for (const [key, attendance] of attendanceMap.entries()) {
      const staff = staffMap.get(attendance.biometric_emp_id);
      
      if (!staff) {
        const errorMsg = `Staff not found for biometric ID: "${attendance.biometric_emp_id}" (Date: ${attendance.date.toISOString().split('T')[0]})`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push(errorMsg);
        continue;
      }
      
      console.log(`\nProcessing: ${staff.name} (Biometric ID: "${attendance.biometric_emp_id}") - Date: ${attendance.date.toISOString().split('T')[0]}`);

      // Check for existing attendance record for this date
      const existingAttendance = await Attendance.findOne({
        staffId: staff._id,
        date: attendance.date
      });

      if (existingAttendance) {
        const dupMsg = `Attendance record already exists for ${staff.name} on ${attendance.date.toISOString().split('T')[0]}`;
        console.log(`  ⏭️  ${dupMsg}`);
        duplicateChecks.push({
          staff: staff.name,
          date: attendance.date.toISOString().split('T')[0],
          message: 'Attendance record already exists for this date'
        });
        continue; // Skip duplicate
      }

      // Calculate working hours per day
      // If overtimeOut exists: (overtimeOut - checkIn), else (checkOut - checkIn)
      let workingHours = 0;
      let overtimeHours = 0;
      let shortHours = 0;
      let isPresent = false;
      let status = 'absent';

      console.log(`  Check-in: ${attendance.checkIn ? attendance.checkIn.toISOString() : 'N/A'}`);
      console.log(`  Check-out: ${attendance.checkOut ? attendance.checkOut.toISOString() : 'N/A'}`);
      console.log(`  Overtime-out: ${attendance.overtimeOut ? attendance.overtimeOut.toISOString() : 'N/A'}`);

      if (attendance.checkIn) {
        const checkInTime = new Date(attendance.checkIn);
        
        // Calculate working hours: if overtimeOut exists, use (overtimeOut - checkIn), else use (checkOut - checkIn)
        if (attendance.overtimeOut) {
          const overtimeTime = new Date(attendance.overtimeOut);
          workingHours = (overtimeTime - checkInTime) / (1000 * 60 * 60); // Convert to hours
        } else if (attendance.checkOut) {
          const checkOutTime = new Date(attendance.checkOut);
          workingHours = (checkOutTime - checkInTime) / (1000 * 60 * 60); // Convert to hours
        }

        if (workingHours > 0) {
          isPresent = true;
          
          // Standard working hours per day = 8 hours
          const standardHours = 8;
          const minimumPresentHours = 7.5; // Minimum hours to be considered present
          
          if (workingHours > standardHours) {
            // Overtime: working hours exceed 8 hours
            overtimeHours = workingHours - standardHours;
            status = 'overtime';
          } else if (workingHours >= minimumPresentHours && workingHours <= standardHours) {
            // Present: working hours between 7.5 and 8 hours (inclusive)
            status = 'present';
            // No short hours for present status
          } else if (workingHours < minimumPresentHours) {
            // Half-day: working hours less than 7.5 hours
            shortHours = standardHours - workingHours;
            status = 'half-day';
          }
        }
      } else {
        console.warn(`  ⚠️  No check-in found. Status will be 'absent'.`);
      }

      console.log(`  Working Hours: ${workingHours.toFixed(2)}, Overtime: ${overtimeHours.toFixed(2)}, Short: ${shortHours.toFixed(2)}, Status: ${status}`);

      attendanceRecords.push({
        biometric_emp_id: attendance.biometric_emp_id,
        staffId: staff._id,
        date: attendance.date,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        overtimeOut: attendance.overtimeOut,
        deviceName: attendance.deviceName,
        workingHours: Math.round(workingHours * 100) / 100, // Round to 2 decimal places
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        shortHours: Math.round(shortHours * 100) / 100,
        isPresent,
        status
      });
      console.log(`  ✓ Record prepared for insertion`);
    }

    // Bulk insert attendance records
    console.log(`\n=== SAVING TO DATABASE ===`);
    console.log(`Records to insert: ${attendanceRecords.length}`);
    
    if (attendanceRecords.length > 0) {
      try {
        await Attendance.insertMany(attendanceRecords, { ordered: false });
        processed = attendanceRecords.length;
        console.log(`✓ Successfully inserted ${processed} attendance records`);
      } catch (insertError) {
        console.error(`❌ Error during bulk insert:`, insertError);
        if (insertError.writeErrors) {
          insertError.writeErrors.forEach((err, idx) => {
            const errorMsg = `Insert error at index ${idx}: ${err.errmsg || err.message}`;
            console.error(`  ${errorMsg}`);
            errors.push(errorMsg);
          });
        }
        // Still count successfully inserted records
        processed = insertError.insertedCount || 0;
      }
    }
    
    console.log(`\n=== IMPORT SUMMARY ===`);
    console.log(`Processed: ${processed}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Duplicates: ${duplicateChecks.length}`);
    console.log(`Skipped: ${skipped.length}`);
    if (errors.length > 0) {
      console.log(`\nError details:`);
      errors.slice(0, 20).forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err}`);
      });
      if (errors.length > 20) {
        console.log(`  ... and ${errors.length - 20} more errors`);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Attendance imported successfully',
      data: {
        processed,
        errors: errors.length > 0 ? errors : undefined,
        duplicates: duplicateChecks.length > 0 ? duplicateChecks : undefined,
        skipped: skipped.length > 0 ? skipped.slice(0, 10) : undefined // Limit skipped messages
      }
    });
  } catch (error) {
    console.error('importAttendance - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing attendance',
      error: error.message
    });
  }
};

// @desc    Get all attendance records
// @route   GET /api/attendance
// @access  Public
const getAllAttendance = async (req, res) => {
  try {
    const { staffId, startDate, endDate, status } = req.query;
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

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    if (status) {
      query.status = status;
    }

    const attendance = await Attendance.find(query)
      .populate('staffId', 'name phone biometric_emp_id')
      .sort({ date: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    console.error('getAllAttendance - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance',
      error: error.message
    });
  }
};

// @desc    Get attendance for specific staff
// @route   GET /api/attendance/staff/:staffId
// @access  Public
const getAttendanceByStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    let query = { staffId };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const attendance = await Attendance.find(query)
      .populate('staffId', 'name phone biometric_emp_id')
      .sort({ date: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: attendance.length,
      data: attendance
    });
  } catch (error) {
    console.error('getAttendanceByStaff - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance',
      error: error.message
    });
  }
};

// @desc    Get attendance summary
// @route   GET /api/attendance/summary
// @access  Public
const getAttendanceSummary = async (req, res) => {
  try {
    const { staffId, startDate, endDate } = req.query;
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

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const attendance = await Attendance.find(query).lean();

    const summary = {
      totalRecords: attendance.length,
      presentDays: attendance.filter(a => a.status === 'present' || a.status === 'overtime').length,
      absentDays: attendance.filter(a => a.status === 'absent').length,
      halfDays: attendance.filter(a => a.status === 'half-day').length,
      overtimeDays: attendance.filter(a => a.status === 'overtime').length,
      totalWorkingHours: attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0),
      totalOvertimeHours: attendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0),
      averageWorkingHours: attendance.length > 0 
        ? attendance.reduce((sum, a) => sum + (a.workingHours || 0), 0) / attendance.length 
        : 0
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('getAttendanceSummary - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance summary',
      error: error.message
    });
  }
};

// @desc    Bulk delete attendance records
// @route   DELETE /api/attendance/bulk
// @access  Public
const bulkDeleteAttendance = async (req, res) => {
  try {
    const { ids } = req.body; // Array of attendance record IDs

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Array of attendance record IDs is required'
      });
    }

    // Validate all IDs are valid ObjectIds
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid attendance record IDs provided'
      });
    }

    const result = await Attendance.deleteMany({ _id: { $in: validIds } });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} attendance record(s)`,
      data: {
        deletedCount: result.deletedCount,
        requestedCount: ids.length,
        validCount: validIds.length
      }
    });
  } catch (error) {
    console.error('bulkDeleteAttendance - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting attendance records',
      error: error.message
    });
  }
};

module.exports = {
  importAttendance,
  getAllAttendance,
  getAttendanceByStaff,
  getAttendanceSummary,
  bulkDeleteAttendance
};



