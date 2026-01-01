const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Client = require('../models/Client');
const BaseService = require('../models/BaseService');
const ServiceVariation = require('../models/ServiceVariation');
const Staff = require('../models/Staff');
const MembershipTier = require('../models/MembershipTier');
const CompanyClosure = require('../models/CompanyClosure');
const PointsHistory = require('../models/PointsHistory');
const BusinessSettings = require('../models/BusinessSettings');

// Helper function to calculate total price
const calculateTotalPrice = (price, membershipDiscount, staffCommission) => {
  return Math.max(0, price - membershipDiscount - staffCommission);
};

// Helper function to validate time slot availability
const validateTimeSlot = async (startTime, staffId, excludeAppointmentId = null) => {
  const query = {
    startTime: new Date(startTime),
    staffId: staffId
  };
  
  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }
  
  const existingAppointment = await Appointment.findOne(query);
  return !existingAppointment;
};

// Helper function to get available time slots for a date
const getAvailableTimeSlots = async (date, staffId = null) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const query = {
    startTime: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $ne: 'cancelled' }
  };
  
  if (staffId) {
    query.staffId = staffId;
  }
  
  const bookedAppointments = await Appointment.find(query).select('startTime staffId');
  
  // Generate all possible time slots (9 AM to 9 PM)
  const timeSlots = [];
  for (let hour = 9; hour <= 21; hour++) {
    const slotTime = new Date(date);
    slotTime.setHours(hour, 0, 0, 0);
    timeSlots.push(slotTime);
  }
  
  // Filter out booked slots
  const availableSlots = timeSlots.filter(slot => {
    if (!staffId) {
      // If no staff specified, check if slot is available for any staff
      return true; // For now, return all slots (can be enhanced)
    }
    
    const isBooked = bookedAppointments.some(apt => {
      const aptTime = new Date(apt.startTime);
      return aptTime.getTime() === slot.getTime() && apt.staffId.toString() === staffId.toString();
    });
    
    return !isBooked;
  });
  
  return availableSlots.map(slot => {
    const hour = slot.getHours();
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    const formatted = `${displayHour} ${period}`;
    return {
      time: slot.toISOString(),
      formatted: formatted
    };
  });
};

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Public
const getAllAppointments = async (req, res) => {
  try {
    console.log('getAllAppointments - Query params:', req.query);
    const { date, staffId, clientId, status, startDate, endDate } = req.query;
    let query = {};

    // Role-based filtering: Therapist can only see their own appointments
    if (req.staff && req.staff.role === 'therapist') {
      query.staffId = req.staff._id;
    }

    // Filter by date (single date)
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.startTime = { $gte: startOfDay, $lte: endOfDay };
    }

    // Filter by date range
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.startTime = { $gte: start, $lte: end };
    }

    // Filter by staff (only if not therapist - therapist is already filtered above)
    if (staffId && (!req.staff || req.staff.role !== 'therapist')) {
      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid staff ID'
        });
      }
      query.staffId = staffId;
    }

    // Filter by client
    if (clientId) {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid client ID'
        });
      }
      query.clientId = clientId;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // For therapist, don't populate client personal data
    const populateFields = req.staff && req.staff.role === 'therapist' 
      ? 'name' // Only name, no phone/email
      : 'name phone email';

    const appointments = await Appointment.find(query)
      .populate('clientId', populateFields)
      .populate('baseServiceId', 'name category')
      .populate('serviceVariationId', 'variationName timeDuration price commission')
      .populate('staffId', 'name specialization')
      .populate('referenceStaffId', 'name')
      .populate('payment_ids', 'status type amount discount payable_amount')
      .sort({ startTime: 1 });

    console.log(`getAllAppointments - Found ${appointments.length} appointments`);

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error) {
    console.error('getAllAppointments - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Get available time slots
// @route   GET /api/appointments/available-slots
// @access  Public
const getAvailableSlots = async (req, res) => {
  try {
    const { date, staffId } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    // Validate staffId if provided
    if (staffId && !mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    const availableSlots = await getAvailableTimeSlots(selectedDate, staffId || null);

    res.status(200).json({
      success: true,
      data: availableSlots
    });
  } catch (error) {
    console.error('getAvailableSlots - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available slots',
      error: error.message
    });
  }
};

// @desc    Get single appointment by ID
// @route   GET /api/appointments/:id
// @access  Public
const getAppointmentById = async (req, res) => {
  try {
    // Role-based filtering: Therapist can only see their own appointments
    let query = { _id: req.params.id };
    if (req.staff && req.staff.role === 'therapist') {
      query.staffId = req.staff._id;
    }

    const appointment = await Appointment.findOne(query)
      .populate({
        path: 'clientId',
        select: req.staff && req.staff.role === 'therapist' 
          ? 'name' // Therapist: only name
          : 'name phone email membership_id points_balance total_sessions rfid_number',
        populate: req.staff && req.staff.role === 'therapist' 
          ? undefined // Therapist: no membership data
          : {
              path: 'membership_id',
              select: 'name discount_percent points_per_session point_value redemption_threshold isActive'
            }
      })
      .populate('baseServiceId', 'name category')
      .populate('serviceVariationId', 'variationName timeDuration price commission')
      .populate('staffId', 'name specialization')
      .populate('referenceStaffId', 'name referralCommission')
      .populate('payment_ids', 'status type amount discount payable_amount createdAt');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // For therapist, sanitize client data
    if (req.staff && req.staff.role === 'therapist' && appointment.clientId) {
      appointment.clientId = {
        _id: appointment.clientId._id,
        name: appointment.clientId.name
      };
    }

    res.status(200).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment',
      error: error.message
    });
  }
};

// @desc    Create new appointment
// @route   POST /api/appointments
// @access  Public
const createAppointment = async (req, res) => {
  try {
    console.log('createAppointment - Request body:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    const { clientId, baseServiceId, serviceVariationId, staffId, startTime, reference } = req.body;

    if (!clientId || !baseServiceId || !serviceVariationId || !staffId || !startTime || !reference) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(clientId) ||
        !mongoose.Types.ObjectId.isValid(baseServiceId) ||
        !mongoose.Types.ObjectId.isValid(serviceVariationId) ||
        !mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format'
      });
    }

    // Validate reference staff if reference is 'staff'
    if (reference === 'staff') {
      if (!req.body.referenceStaffId || !mongoose.Types.ObjectId.isValid(req.body.referenceStaffId)) {
        return res.status(400).json({
          success: false,
          message: 'Reference staff ID is required when reference is "staff"'
        });
      }
    }

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if base service exists and is active
    const baseService = await BaseService.findById(baseServiceId);
    if (!baseService) {
      return res.status(404).json({
        success: false,
        message: 'Base service not found'
      });
    }
    if (!baseService.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Base service is not active'
      });
    }

    // Check if service variation exists, is active, and belongs to base service
    const serviceVariation = await ServiceVariation.findById(serviceVariationId);
    if (!serviceVariation) {
      return res.status(404).json({
        success: false,
        message: 'Service variation not found'
      });
    }
    if (!serviceVariation.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Service variation is not active'
      });
    }
    if (serviceVariation.baseService.toString() !== baseServiceId) {
      return res.status(400).json({
        success: false,
        message: 'Service variation does not belong to the selected base service'
      });
    }

    // Check if staff exists and is active
    const staff = await Staff.findById(staffId);
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }
    if (staff.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Staff is not active'
      });
    }

    // Check if reference staff exists (if provided)
    let referenceStaff = null;
    if (reference === 'staff' && req.body.referenceStaffId) {
      referenceStaff = await Staff.findById(req.body.referenceStaffId);
      if (!referenceStaff) {
        return res.status(404).json({
          success: false,
          message: 'Reference staff not found'
        });
      }
    }

    // Parse and validate start time
    const appointmentStartTime = new Date(startTime);
    if (isNaN(appointmentStartTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start time format'
      });
    }

    // Check if appointment date is a company closure/holiday
    const appointmentDate = new Date(appointmentStartTime);
    appointmentDate.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
    
    const closure = await CompanyClosure.findOne({ date: appointmentDate });
    if (closure) {
      const closureType = closure.isHoliday ? 'holiday' : 'company closure';
      return res.status(400).json({
        success: false,
        message: `Cannot create appointment on ${closureType}${closure.reason ? `: ${closure.reason}` : ''}`
      });
    }

    // Round to nearest hour (remove minutes and seconds)
    appointmentStartTime.setMinutes(0, 0, 0);

    // Validate time slot availability
    const isSlotAvailable = await validateTimeSlot(appointmentStartTime, staffId);
    if (!isSlotAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Time slot is already booked for this staff member'
      });
    }

    // Get price from service variation
    const price = serviceVariation.price;

    // Calculate membership discount based on client's membership tier
    let membershipDiscount = 0;
    let pointsToAward = 0;
    let calculatedDiscount = 0;
    
    // Check if client has membership and calculate discount
    if (client.membership_id) {
      // Fetch membership tier with all fields
      const membershipTier = await MembershipTier.findById(client.membership_id);
      
      if (membershipTier) {
        if (membershipTier.isActive) {
          // Calculate discount: price * (discount_percent / 100)
          calculatedDiscount = price * (membershipTier.discount_percent / 100);
          // Store points to be awarded (will be awarded when appointment is completed)
          pointsToAward = membershipTier.points_per_session || 0;
          
          console.log('Backend: Membership discount calculated:', {
            clientId: client._id,
            tierName: membershipTier.name,
            discountPercent: membershipTier.discount_percent,
            price,
            calculatedDiscount,
            pointsToAward,
            isActive: membershipTier.isActive
          });
          
          // Use calculated discount as default
          membershipDiscount = calculatedDiscount;
        } else {
          console.warn('Backend: Client has membership tier but it is inactive:', {
            clientId: client._id,
            tierId: membershipTier._id,
            tierName: membershipTier.name,
            isActive: membershipTier.isActive
          });
        }
      } else {
        console.warn('Backend: Client has membership_id but tier not found:', client.membership_id);
      }
    } else {
      console.log('Backend: Client has no membership_id, discount will be 0');
    }
    
    // Allow override from request body if explicitly provided (for manual adjustments)
    // But log if there's a discrepancy
    if (req.body.membershipDiscount !== undefined && req.body.membershipDiscount !== null) {
      const overrideDiscount = Number(req.body.membershipDiscount);
      if (Math.abs(overrideDiscount - calculatedDiscount) > 0.01) {
        console.log('Backend: Using manual discount override:', {
          calculatedDiscount,
          overrideDiscount,
          difference: overrideDiscount - calculatedDiscount
        });
      }
      membershipDiscount = overrideDiscount;
    }

    // Calculate staff commission if reference staff is selected
    // Allow override from request body if explicitly provided (for manual adjustments)
    let staffCommission = 0;
    if (req.body.staffCommission !== undefined && req.body.staffCommission !== null) {
      // Use provided staff commission from frontend
      staffCommission = Number(req.body.staffCommission);
      console.log('Backend: Using staff commission from request:', staffCommission);
    } else if (reference === 'staff' && referenceStaff && referenceStaff.referralCommission !== undefined && referenceStaff.referralCommission !== null) {
      // Calculate commission: price * referralCommission
      staffCommission = price * referenceStaff.referralCommission;
      console.log('Backend staff commission calculation:', {
        price,
        referralCommission: referenceStaff.referralCommission,
        staffCommission,
        staffName: referenceStaff.name
      });
    } else {
      console.warn('Reference staff commission not calculated:', {
        reference,
        referenceStaff: referenceStaff ? { _id: referenceStaff._id, name: referenceStaff.name, referralCommission: referenceStaff.referralCommission } : null,
        providedStaffCommission: req.body.staffCommission
      });
    }

    // Handle points redemption if provided
    let pointsUsed = 0;
    let pointsDiscount = 0;
    if (req.body.pointsToRedeem !== undefined && Number(req.body.pointsToRedeem) > 0) {
      const pointsToRedeem = Number(req.body.pointsToRedeem);
      
      // Validate points redemption
      if (pointsToRedeem > client.points_balance) {
        return res.status(400).json({
          success: false,
          message: `Insufficient points balance. Available: ${client.points_balance}, Requested: ${pointsToRedeem}`
        });
      }

      // Get BusinessSettings for point value and threshold
      const businessSettings = await BusinessSettings.findOne() || await BusinessSettings.create({});
      
      if (pointsToRedeem < businessSettings.redemptionThreshold) {
        return res.status(400).json({
          success: false,
          message: `Points redemption must be at least ${businessSettings.redemptionThreshold} points`
        });
      }

      // Calculate discount from points
      pointsDiscount = pointsToRedeem * businessSettings.pointValue;
      pointsUsed = pointsToRedeem;

      // Deduct points from client balance
      client.points_balance = Math.max(0, client.points_balance - pointsToRedeem);
      await client.save();

      // Create points history entry (appointmentId will be set after appointment creation)
      await PointsHistory.create({
        clientId: client._id,
        appointmentId: null, // Will be updated after appointment creation
        points: -pointsToRedeem, // Negative for redeemed
        type: 'redeemed',
        description: `Points redeemed for appointment`
      });
    }

    // Calculate total price (including points discount)
    const totalPrice = Math.max(0, price - membershipDiscount - pointsDiscount - staffCommission);

    // Prepare appointment data (payment fields removed - handled separately in Payment model)
    const appointmentData = {
      clientId,
      baseServiceId,
      serviceVariationId,
      staffId,
      startTime: appointmentStartTime,
      reference,
      referenceStaffId: reference === 'staff' ? req.body.referenceStaffId : null,
      membership: client.membership_id ? true : (req.body.membership === true), // Auto-set if client has membership
      price,
      membershipDiscount,
      staffCommission,
      totalPrice,
      status: req.body.status || 'scheduled',
      notes: req.body.notes || null,
      payment_ids: [], // Initialize empty payment_ids array
      pointsUsed: pointsUsed,
      pointsAwarded: 0 // Will be set when appointment is completed
    };

    console.log('createAppointment - Processed data:', JSON.stringify(appointmentData, null, 2));

    const appointment = await Appointment.create(appointmentData);

    // Update points history with appointment ID if points were used
    if (pointsUsed > 0) {
      await PointsHistory.updateOne(
        { clientId: client._id, appointmentId: null, type: 'redeemed' },
        { appointmentId: appointment._id },
        { sort: { createdAt: -1 } }
      );
    }

    // Populate and return
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('clientId', 'name phone email')
      .populate('baseServiceId', 'name category')
      .populate('serviceVariationId', 'variationName timeDuration price commission')
      .populate('staffId', 'name specialization')
      .populate('referenceStaffId', 'name')
      .populate('payment_ids', 'status type amount discount payable_amount');

    res.status(201).json({
      success: true,
      data: populatedAppointment
    });
  } catch (error) {
    console.error('createAppointment - Error:', error);
    console.error('createAppointment - Error details:', {
      name: error.name,
      code: error.code,
      message: error.message,
      errors: error.errors
    });

    if (error.code === 11000) {
      // Duplicate key error (double booking)
      return res.status(400).json({
        success: false,
        message: 'Time slot is already booked for this staff member'
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
      message: 'Error creating appointment',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Public
const updateAppointment = async (req, res) => {
  try {
    console.log('updateAppointment - Request params:', req.params);
    console.log('updateAppointment - Request body:', JSON.stringify(req.body, null, 2));

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Validate ObjectIds if provided
    if (req.body.clientId && !mongoose.Types.ObjectId.isValid(req.body.clientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }
    if (req.body.baseServiceId && !mongoose.Types.ObjectId.isValid(req.body.baseServiceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid base service ID'
      });
    }
    if (req.body.serviceVariationId && !mongoose.Types.ObjectId.isValid(req.body.serviceVariationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service variation ID'
      });
    }
    if (req.body.staffId && !mongoose.Types.ObjectId.isValid(req.body.staffId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid staff ID'
      });
    }

    // If startTime or staffId is being updated, validate time slot
    if (req.body.startTime || req.body.staffId) {
      const newStartTime = req.body.startTime ? new Date(req.body.startTime) : appointment.startTime;
      
      // Check if new appointment date is a company closure/holiday
      if (req.body.startTime) {
        const appointmentDate = new Date(newStartTime);
        appointmentDate.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
        
        const closure = await CompanyClosure.findOne({ date: appointmentDate });
        if (closure) {
          const closureType = closure.isHoliday ? 'holiday' : 'company closure';
          return res.status(400).json({
            success: false,
            message: `Cannot update appointment to ${closureType}${closure.reason ? `: ${closure.reason}` : ''}`
          });
        }
      }
      
      newStartTime.setMinutes(0, 0, 0);
      const newStaffId = req.body.staffId || appointment.staffId;

      const isSlotAvailable = await validateTimeSlot(newStartTime, newStaffId, req.params.id);
      if (!isSlotAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Time slot is already booked for this staff member'
        });
      }
    }

    // If service variation is being updated, recalculate price
    let price = appointment.price;
    if (req.body.serviceVariationId) {
      const serviceVariation = await ServiceVariation.findById(req.body.serviceVariationId);
      if (!serviceVariation) {
        return res.status(404).json({
          success: false,
          message: 'Service variation not found'
        });
      }
      price = serviceVariation.price;
    }

    // Get client to check membership (if clientId is being updated, fetch new client)
    let client = null;
    const clientIdToCheck = req.body.clientId || appointment.clientId;
    if (req.body.clientId || req.body.serviceVariationId) {
      client = await Client.findById(clientIdToCheck);
      if (!client && req.body.clientId) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }
    } else {
      // Use existing appointment's client
      client = await Client.findById(appointment.clientId);
    }

    // Recalculate membership discount if client or service variation changes
    let membershipDiscount = appointment.membershipDiscount;
    let calculatedDiscount = appointment.membershipDiscount;
    
    if ((req.body.clientId || req.body.serviceVariationId) && client) {
      if (client.membership_id) {
        const membershipTier = await MembershipTier.findById(client.membership_id);
        if (membershipTier && membershipTier.isActive) {
          calculatedDiscount = price * (membershipTier.discount_percent / 100);
          console.log('Backend Update: Membership discount recalculated:', {
            clientId: client._id,
            tierName: membershipTier.name,
            discountPercent: membershipTier.discount_percent,
            price,
            calculatedDiscount,
            isActive: membershipTier.isActive
          });
          membershipDiscount = calculatedDiscount;
        } else {
          console.log('Backend Update: Client membership tier not found or inactive, setting discount to 0');
          membershipDiscount = 0;
          calculatedDiscount = 0;
        }
      } else {
        // Client has no membership
        console.log('Backend Update: Client has no membership, setting discount to 0');
        membershipDiscount = 0;
        calculatedDiscount = 0;
      }
    } else if (req.body.clientId && (!client || !client.membership_id)) {
      // Client changed to one without membership
      membershipDiscount = 0;
      calculatedDiscount = 0;
    }
    
    // Allow manual override if explicitly provided (for manual adjustments)
    if (req.body.membershipDiscount !== undefined && req.body.membershipDiscount !== null) {
      const overrideDiscount = Number(req.body.membershipDiscount);
      if (Math.abs(overrideDiscount - calculatedDiscount) > 0.01) {
        console.log('Backend Update: Using manual discount override:', {
          calculatedDiscount,
          overrideDiscount,
          difference: overrideDiscount - calculatedDiscount
        });
      }
      membershipDiscount = overrideDiscount;
    }

    // Recalculate commission if reference staff changes or if service variation/price changes
    let staffCommission = appointment.staffCommission;
    const reference = req.body.reference !== undefined ? req.body.reference : appointment.reference;
    const referenceStaffId = req.body.referenceStaffId !== undefined ? req.body.referenceStaffId : appointment.referenceStaffId;
    
    // Only recalculate if reference is 'staff' and we have a referenceStaffId
    if (reference === 'staff' && referenceStaffId) {
      const referenceStaff = await Staff.findById(referenceStaffId);
      if (referenceStaff && referenceStaff.referralCommission !== undefined && referenceStaff.referralCommission !== null) {
        // referralCommission is a decimal between 0 and 1 (e.g., 0.1 = 10%)
        // Calculate commission as: price * referralCommission
        staffCommission = price * referenceStaff.referralCommission;
        console.log('Backend update staff commission calculation:', {
          price,
          referralCommission: referenceStaff.referralCommission,
          staffCommission,
          staffName: referenceStaff.name
        });
      } else {
        console.warn('Update: Reference staff not found or missing referralCommission:', {
          referenceStaffId: referenceStaffId,
          referenceStaff: referenceStaff ? { _id: referenceStaff._id, name: referenceStaff.name, referralCommission: referenceStaff.referralCommission } : null
        });
        staffCommission = 0;
      }
    } else if (reference !== 'staff') {
      staffCommission = 0;
    } else if (req.body.serviceVariationId && appointment.reference === 'staff' && appointment.referenceStaffId) {
      // If service variation changes but reference is still 'staff', recalculate commission with new price
      const referenceStaff = await Staff.findById(appointment.referenceStaffId);
      if (referenceStaff && referenceStaff.referralCommission !== undefined && referenceStaff.referralCommission !== null) {
        staffCommission = price * referenceStaff.referralCommission;
      }
    }

    // Handle points redemption if provided
    let pointsUsed = appointment.pointsUsed || 0;
    let pointsDiscount = 0;
    if (req.body.pointsToRedeem !== undefined && Number(req.body.pointsToRedeem) > 0) {
      const pointsToRedeem = Number(req.body.pointsToRedeem);
      
      // Get current client (or updated client if clientId changed)
      const currentClient = client || await Client.findById(appointment.clientId);
      
      if (!currentClient) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }

      // Calculate available points (account for already used points if reverting)
      const availablePoints = currentClient.points_balance + (appointment.pointsUsed || 0);
      
      // Validate points redemption
      if (pointsToRedeem > availablePoints) {
        return res.status(400).json({
          success: false,
          message: `Insufficient points balance. Available: ${availablePoints}, Requested: ${pointsToRedeem}`
        });
      }

      // Get BusinessSettings for point value and threshold
      const businessSettings = await BusinessSettings.findOne() || await BusinessSettings.create({});
      
      if (pointsToRedeem < businessSettings.redemptionThreshold) {
        return res.status(400).json({
          success: false,
          message: `Points redemption must be at least ${businessSettings.redemptionThreshold} points`
        });
      }

      // Revert previously used points if any
      if (appointment.pointsUsed > 0) {
        currentClient.points_balance += appointment.pointsUsed;
        // Delete old points history entry
        await PointsHistory.deleteOne({ 
          appointmentId: appointment._id, 
          type: 'redeemed' 
        });
      }

      // Calculate discount from points
      pointsDiscount = pointsToRedeem * businessSettings.pointValue;
      pointsUsed = pointsToRedeem;

      // Deduct points from client balance
      currentClient.points_balance = Math.max(0, currentClient.points_balance - pointsToRedeem);
      await currentClient.save();

      // Create points history entry
      await PointsHistory.create({
        clientId: currentClient._id,
        appointmentId: appointment._id,
        points: -pointsToRedeem, // Negative for redeemed
        type: 'redeemed',
        description: `Points redeemed for appointment`
      });
    } else if (req.body.pointsToRedeem === 0 || req.body.pointsToRedeem === null) {
      // Revert points if explicitly set to 0 or null
      if (appointment.pointsUsed > 0) {
        const currentClient = client || await Client.findById(appointment.clientId);
        if (currentClient) {
          currentClient.points_balance += appointment.pointsUsed;
          await currentClient.save();
          // Delete points history entry
          await PointsHistory.deleteOne({ 
            appointmentId: appointment._id, 
            type: 'redeemed' 
          });
        }
        pointsUsed = 0;
      }
    }

    // Recalculate total price (membership discount + points discount)
    const totalPrice = Math.max(0, price - membershipDiscount - pointsDiscount - staffCommission);

    // Update only provided fields
    const updateData = {};
    if (req.body.clientId !== undefined) updateData.clientId = req.body.clientId;
    if (req.body.baseServiceId !== undefined) updateData.baseServiceId = req.body.baseServiceId;
    if (req.body.serviceVariationId !== undefined) {
      updateData.serviceVariationId = req.body.serviceVariationId;
      updateData.price = price;
    }
    if (req.body.staffId !== undefined) updateData.staffId = req.body.staffId;
    if (req.body.startTime !== undefined) {
      const newStartTime = new Date(req.body.startTime);
      newStartTime.setMinutes(0, 0, 0);
      updateData.startTime = newStartTime;
    }
    if (req.body.reference !== undefined) {
      updateData.reference = req.body.reference;
      if (req.body.reference === 'staff') {
        updateData.referenceStaffId = req.body.referenceStaffId || null;
      } else {
        updateData.referenceStaffId = null;
      }
    } else if (req.body.referenceStaffId !== undefined) {
      // If only referenceStaffId is being updated
      updateData.referenceStaffId = req.body.referenceStaffId;
    }
    // Auto-set membership based on client's membership status
    if (req.body.clientId !== undefined) {
      updateData.membership = client && client.membership_id ? true : false;
    } else if (req.body.membership !== undefined) {
      updateData.membership = req.body.membership;
    }
    // Always update membershipDiscount if it was recalculated or provided
    if (req.body.clientId !== undefined || req.body.serviceVariationId !== undefined || req.body.membershipDiscount !== undefined) {
      updateData.membershipDiscount = membershipDiscount;
    }
    // Always update staffCommission if reference or service variation changes (recalculation happened above)
    if (req.body.reference !== undefined || req.body.referenceStaffId !== undefined || req.body.serviceVariationId !== undefined) {
      updateData.staffCommission = staffCommission;
    } else if (req.body.staffCommission !== undefined) {
      updateData.staffCommission = req.body.staffCommission;
    }
    // Always update totalPrice when prices change
    updateData.totalPrice = totalPrice;
    // Payment fields removed - handled separately in Payment model
    
    // Handle points awarding when status changes to completed
    const previousStatus = appointment.status;
    if (req.body.status !== undefined) {
      // Prevent setting future appointments as completed
      if (req.body.status === 'completed') {
        const appointmentTime = new Date(appointment.startTime);
        const now = new Date();
        
        if (appointmentTime > now) {
          return res.status(400).json({
            success: false,
            message: 'Cannot mark future appointments as completed'
          });
        }
      }
      updateData.status = req.body.status;
      
      // Award points when status changes to completed
      if (req.body.status === 'completed' && previousStatus !== 'completed') {
        // Get client with membership
        const currentClient = await Client.findById(appointment.clientId)
          .populate('membership_id');
        
        if (currentClient && currentClient.membership_id && appointment.pointsAwarded === 0) {
          const membershipTier = typeof currentClient.membership_id === 'object' 
            ? currentClient.membership_id 
            : await MembershipTier.findById(currentClient.membership_id);
          
          if (membershipTier && membershipTier.isActive) {
            const pointsToAward = membershipTier.points_per_session || 0;
            
            if (pointsToAward > 0) {
              // Increment client points balance
              currentClient.points_balance = (currentClient.points_balance || 0) + pointsToAward;
              
              // Increment session count
              currentClient.total_sessions = (currentClient.total_sessions || 0) + 1;
              
              await currentClient.save();
              
              // Create points history entry
              await PointsHistory.create({
                clientId: currentClient._id,
                appointmentId: appointment._id,
                points: pointsToAward,
                type: 'earned',
                description: `Points earned from completed appointment`
              });
              
              // Update appointment with points awarded
              updateData.pointsAwarded = pointsToAward;
              
              // Check if max_sessions_before_reset is reached
              if (membershipTier.max_sessions_before_reset && 
                  currentClient.total_sessions >= membershipTier.max_sessions_before_reset) {
                console.warn(`Client ${currentClient._id} has reached max sessions (${membershipTier.max_sessions_before_reset}) for tier ${membershipTier.name}`);
              }
            }
          }
        }
      }
      
      // Handle reverting points when status changes FROM completed
      if (previousStatus === 'completed' && req.body.status !== 'completed' && appointment.pointsAwarded > 0) {
        const currentClient = await Client.findById(appointment.clientId);
        
        if (currentClient) {
          // Revert points
          currentClient.points_balance = Math.max(0, (currentClient.points_balance || 0) - appointment.pointsAwarded);
          
          // Revert session count
          currentClient.total_sessions = Math.max(0, (currentClient.total_sessions || 0) - 1);
          
          await currentClient.save();
          
          // Delete points history entry for this appointment
          await PointsHistory.deleteOne({ 
            appointmentId: appointment._id, 
            type: 'earned' 
          });
          
          // Reset points awarded
          updateData.pointsAwarded = 0;
        }
      }
    }
    if (req.body.notes !== undefined) updateData.notes = req.body.notes || null;

    console.log('updateAppointment - Update data:', JSON.stringify(updateData, null, 2));

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('clientId', 'name phone email')
      .populate('baseServiceId', 'name category')
      .populate('serviceVariationId', 'variationName timeDuration price commission')
      .populate('staffId', 'name specialization')
      .populate('referenceStaffId', 'name')
      .populate('payment_ids', 'status type amount discount payable_amount');

    res.status(200).json({
      success: true,
      data: updatedAppointment
    });
  } catch (error) {
    console.error('updateAppointment - Error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID or related ID'
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Time slot is already booked for this staff member'
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
      message: 'Error updating appointment',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Update appointment status only
// @route   PATCH /api/appointments/:id/status
// @access  Public
const updateAppointmentStatus = async (req, res) => {
  try {
    console.log('updateAppointmentStatus - Request params:', req.params);
    console.log('updateAppointmentStatus - Request body:', JSON.stringify(req.body, null, 2));

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Validate status
    const validStatuses = ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled'];
    if (!req.body.status || !validStatuses.includes(req.body.status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Prevent setting future appointments as completed
    if (req.body.status === 'completed') {
      const appointmentTime = new Date(appointment.startTime);
      const now = new Date();
      
      if (appointmentTime > now) {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark future appointments as completed'
        });
      }
    }

    // Handle points awarding when status changes to completed
    const previousStatus = appointment.status;
    const newStatus = req.body.status;
    const updateData = { status: newStatus };
    
    if (newStatus === 'completed' && previousStatus !== 'completed') {
      // Get client with membership
      const currentClient = await Client.findById(appointment.clientId)
        .populate('membership_id');
      
      if (currentClient && currentClient.membership_id && appointment.pointsAwarded === 0) {
        const membershipTier = typeof currentClient.membership_id === 'object' 
          ? currentClient.membership_id 
          : await MembershipTier.findById(currentClient.membership_id);
        
        if (membershipTier && membershipTier.isActive) {
          const pointsToAward = membershipTier.points_per_session || 0;
          
          if (pointsToAward > 0) {
            // Increment client points balance
            currentClient.points_balance = (currentClient.points_balance || 0) + pointsToAward;
            
            // Increment session count
            currentClient.total_sessions = (currentClient.total_sessions || 0) + 1;
            
            await currentClient.save();
            
            // Create points history entry
            await PointsHistory.create({
              clientId: currentClient._id,
              appointmentId: appointment._id,
              points: pointsToAward,
              type: 'earned',
              description: `Points earned from completed appointment`
            });
            
            // Update appointment with points awarded
            updateData.pointsAwarded = pointsToAward;
            
            // Check if max_sessions_before_reset is reached
            if (membershipTier.max_sessions_before_reset && 
                currentClient.total_sessions >= membershipTier.max_sessions_before_reset) {
              console.warn(`Client ${currentClient._id} has reached max sessions (${membershipTier.max_sessions_before_reset}) for tier ${membershipTier.name}`);
            }
          }
        }
      }
    }
    
    // Handle reverting points when status changes FROM completed
    if (previousStatus === 'completed' && newStatus !== 'completed' && appointment.pointsAwarded > 0) {
      const currentClient = await Client.findById(appointment.clientId);
      
      if (currentClient) {
        // Revert points
        currentClient.points_balance = Math.max(0, (currentClient.points_balance || 0) - appointment.pointsAwarded);
        
        // Revert session count
        currentClient.total_sessions = Math.max(0, (currentClient.total_sessions || 0) - 1);
        
        await currentClient.save();
        
        // Delete points history entry for this appointment
        await PointsHistory.deleteOne({ 
          appointmentId: appointment._id, 
          type: 'earned' 
        });
        
        // Reset points awarded
        updateData.pointsAwarded = 0;
      }
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('clientId', 'name phone email')
      .populate('baseServiceId', 'name category')
      .populate('serviceVariationId', 'variationName timeDuration price commission')
      .populate('staffId', 'name specialization')
      .populate('referenceStaffId', 'name')
      .populate('payment_ids', 'status type amount discount payable_amount');

    res.status(200).json({
      success: true,
      data: updatedAppointment,
      message: `Status updated to ${req.body.status}`
    });
  } catch (error) {
    console.error('updateAppointmentStatus - Error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating appointment status',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Public
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    await Appointment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting appointment',
      error: error.message
    });
  }
};

module.exports = {
  getAllAppointments,
  getAvailableSlots,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  updateAppointmentStatus,
  deleteAppointment
};

