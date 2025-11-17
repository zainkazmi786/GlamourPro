const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Appointment = require('../models/Appointment');
const Client = require('../models/Client');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// @desc    Get all payments
// @route   GET /api/payments
// @access  Public
const getAllPayments = async (req, res) => {
  try {
    const { 
      appointmentId, 
      clientId, 
      status, 
      type, 
      startDate, 
      endDate, 
      hasMembership 
    } = req.query;
    
    let query = {};
    
    // Filter by appointment
    if (appointmentId) {
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid appointment ID'
        });
      }
      query.appointment_id = appointmentId;
    }
    
    // Filter by client (through appointment)
    if (clientId) {
      if (!mongoose.Types.ObjectId.isValid(clientId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid client ID'
        });
      }
      // Find appointments for this client
      const appointments = await Appointment.find({ clientId }).select('_id');
      const appointmentIds = appointments.map(apt => apt._id);
      query.appointment_id = { $in: appointmentIds };
    }
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Filter by type
    if (type) {
      query.type = type;
    }
    
    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    
    // Get payments with populated appointment
    let payments = await Payment.find(query)
      .populate({
        path: 'appointment_id',
        populate: [
          { path: 'clientId', select: 'name phone email membership_id' },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price' },
          { path: 'staffId', select: 'name specialization' }
        ]
      })
      .sort({ createdAt: -1 });
    
    // Filter by membership if specified
    if (hasMembership !== undefined) {
      const hasMembershipBool = hasMembership === 'true';
      payments = payments.filter(payment => {
        const appointment = payment.appointment_id;
        if (!appointment || !appointment.clientId) return false;
        const client = appointment.clientId;
        const hasMembership = client.membership_id !== null && client.membership_id !== undefined;
        return hasMembership === hasMembershipBool;
      });
    }
    
    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    console.error('getAllPayments - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// @desc    Get single payment by ID
// @route   GET /api/payments/:id
// @access  Public
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate({
        path: 'appointment_id',
        populate: [
          { 
            path: 'clientId', 
            select: 'name phone email membership_id points_balance total_sessions',
            populate: {
              path: 'membership_id',
              select: 'name discount_percent points_per_session'
            }
          },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price commission' },
          { path: 'staffId', select: 'name specialization' }
        ]
      });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error fetching payment',
      error: error.message
    });
  }
};

// @desc    Create new payment
// @route   POST /api/payments
// @access  Public
const createPayment = async (req, res) => {
  try {
    const { appointment_id, type, amount, discount, payable_amount, notes, status } = req.body;
    
    // Validate required fields
    if (!appointment_id || !type || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: appointment_id, type, amount'
      });
    }
    
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(appointment_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID'
      });
    }
    
    // Check if appointment exists
    const appointment = await Appointment.findById(appointment_id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Calculate payable amount if not provided
    const calculatedPayable = amount - (discount || 0);
    const finalPayableAmount = payable_amount !== undefined ? payable_amount : calculatedPayable;
    
    // Validate payable amount doesn't exceed appointment total
    // Note: We check payable_amount (amount - discount) against appointment total,
    // not just the amount, since that's what actually gets deducted
    const existingPayments = await Payment.find({ appointment_id });
    const totalPaid = existingPayments.reduce((sum, p) => sum + (p.payable_amount || p.amount - (p.discount || 0)), 0);
    if (totalPaid + finalPayableAmount > appointment.totalPrice) {
      return res.status(400).json({
        success: false,
        message: `Payable amount (PKR ${finalPayableAmount}) exceeds appointment total. Remaining: PKR ${appointment.totalPrice - totalPaid}`
      });
    }
    
    // Validate discount doesn't exceed amount
    if (discount && discount > amount) {
      return res.status(400).json({
        success: false,
        message: 'Discount cannot be greater than amount'
      });
    }
    
    // Validate payable amount is positive
    if (finalPayableAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payable amount must be greater than 0'
      });
    }
    
    // Create payment
    const paymentData = {
      appointment_id,
      type,
      amount: Number(amount),
      discount: discount ? Number(discount) : 0,
      payable_amount: finalPayableAmount,
      notes: notes || null,
      status: status || 'pending'
    };
    
    const payment = await Payment.create(paymentData);
    
    // Update appointment's payment_ids
    if (!appointment.payment_ids) {
      appointment.payment_ids = [];
    }
    appointment.payment_ids.push(payment._id);
    await appointment.save();
    
    // Populate and return
    const populatedPayment = await Payment.findById(payment._id)
      .populate({
        path: 'appointment_id',
        populate: [
          { path: 'clientId', select: 'name phone email' },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price' },
          { path: 'staffId', select: 'name specialization' }
        ]
      });
    
    res.status(201).json({
      success: true,
      data: populatedPayment
    });
  } catch (error) {
    console.error('createPayment - Error:', error);
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
      message: 'Error creating payment',
      error: error.message
    });
  }
};

// @desc    Update payment
// @route   PUT /api/payments/:id
// @access  Public
const updatePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    const { type, amount, discount, payable_amount, status, notes } = req.body;
    
    // Update fields
    if (type !== undefined) payment.type = type;
    if (amount !== undefined) payment.amount = Number(amount);
    if (discount !== undefined) payment.discount = Number(discount);
    if (status !== undefined) payment.status = status;
    if (notes !== undefined) payment.notes = notes || null;
    
    // Recalculate payable amount if amount or discount changed
    if (amount !== undefined || discount !== undefined) {
      payment.payable_amount = payment.amount - payment.discount;
    } else if (payable_amount !== undefined) {
      payment.payable_amount = Number(payable_amount);
    }
    
    // Validate payable amount doesn't exceed appointment total
    // Note: We check payable_amount (amount - discount) against appointment total,
    // not just the amount, since that's what actually gets deducted
    const appointment = await Appointment.findById(payment.appointment_id);
    if (appointment && (amount !== undefined || discount !== undefined || payable_amount !== undefined)) {
      const existingPayments = await Payment.find({ 
        appointment_id: payment.appointment_id,
        _id: { $ne: payment._id }
      });
      const totalPaid = existingPayments.reduce((sum, p) => sum + (p.payable_amount || p.amount - (p.discount || 0)), 0);
      const finalPayableAmount = payment.payable_amount || payment.amount - (payment.discount || 0);
      
      if (totalPaid + finalPayableAmount > appointment.totalPrice) {
        return res.status(400).json({
          success: false,
          message: `Payable amount (PKR ${finalPayableAmount}) exceeds appointment total. Remaining: PKR ${appointment.totalPrice - totalPaid}`
        });
      }
      
      // Validate discount doesn't exceed amount
      if (payment.discount > payment.amount) {
        return res.status(400).json({
          success: false,
          message: 'Discount cannot be greater than amount'
        });
      }
      
      // Validate payable amount is positive
      if (finalPayableAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Payable amount must be greater than 0'
        });
      }
    }
    
    await payment.save();
    
    // Populate and return
    const populatedPayment = await Payment.findById(payment._id)
      .populate({
        path: 'appointment_id',
        populate: [
          { path: 'clientId', select: 'name phone email' },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price' },
          { path: 'staffId', select: 'name specialization' }
        ]
      });
    
    res.status(200).json({
      success: true,
      data: populatedPayment
    });
  } catch (error) {
    console.error('updatePayment - Error:', error);
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
      message: 'Error updating payment',
      error: error.message
    });
  }
};

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Public
const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Remove from appointment's payment_ids
    const appointment = await Appointment.findById(payment.appointment_id);
    if (appointment) {
      appointment.payment_ids = appointment.payment_ids.filter(
        id => id.toString() !== payment._id.toString()
      );
      await appointment.save();
    }
    
    // Delete payment
    await Payment.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Payment deleted successfully'
    });
  } catch (error) {
    console.error('deletePayment - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting payment',
      error: error.message
    });
  }
};

// @desc    Split payment
// @route   POST /api/payments/:id/split
// @access  Public
const splitPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    const { splits } = req.body;
    
    if (!splits || !Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 splits are required'
      });
    }
    
    // Validate splits sum equals original amount
    const totalSplitAmount = splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
    if (Math.abs(totalSplitAmount - payment.amount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: `Split amounts must equal original amount. Original: ${payment.amount}, Sum: ${totalSplitAmount}`
      });
    }
    
    // Use original discount for all splits (no different discounts allowed)
    const originalDiscount = payment.discount;
    const discountPerSplit = originalDiscount / splits.length;
    
    // Create split payments
    const splitPayments = [];
    const appointment = await Appointment.findById(payment.appointment_id);
    
    for (const split of splits) {
      if (!split.type || split.amount === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Each split must have type and amount'
        });
      }
      
      const splitPaymentData = {
        appointment_id: payment.appointment_id,
        type: split.type,
        amount: Number(split.amount),
        discount: discountPerSplit,
        payable_amount: Number(split.amount) - discountPerSplit,
        status: payment.status,
        notes: `Split from payment ${payment._id}. ${split.notes || ''}`
      };
      
      const newPayment = await Payment.create(splitPaymentData);
      splitPayments.push(newPayment);
      
      // Add to appointment's payment_ids
      if (appointment) {
        appointment.payment_ids.push(newPayment._id);
      }
    }
    
    // Remove original payment from appointment
    if (appointment) {
      appointment.payment_ids = appointment.payment_ids.filter(
        id => id.toString() !== payment._id.toString()
      );
      await appointment.save();
    }
    
    // Delete original payment
    await Payment.findByIdAndDelete(payment._id);
    
    // Populate split payments
    const populatedPayments = await Payment.find({ _id: { $in: splitPayments.map(p => p._id) } })
      .populate({
        path: 'appointment_id',
        populate: [
          { path: 'clientId', select: 'name phone email' },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price' },
          { path: 'staffId', select: 'name specialization' }
        ]
      });
    
    res.status(200).json({
      success: true,
      message: `Payment split into ${splitPayments.length} payments`,
      data: populatedPayments
    });
  } catch (error) {
    console.error('splitPayment - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error splitting payment',
      error: error.message
    });
  }
};

// @desc    Combine payments
// @route   POST /api/payments/combine
// @access  Public
const combinePayments = async (req, res) => {
  try {
    const { payment_ids, type, notes } = req.body;
    
    if (!payment_ids || !Array.isArray(payment_ids) || payment_ids.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 payment IDs are required'
      });
    }
    
    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Payment type is required'
      });
    }
    
    // Validate ObjectIds
    for (const id of payment_ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment ID: ${id}`
        });
      }
    }
    
    // Get payments
    const payments = await Payment.find({ _id: { $in: payment_ids } })
      .populate({
        path: 'appointment_id',
        populate: { path: 'clientId', select: 'name phone email _id' }
      });
    
    if (payments.length !== payment_ids.length) {
      return res.status(404).json({
        success: false,
        message: 'One or more payments not found'
      });
    }
    
    // Validate all payments belong to same client
    const clientIds = payments.map(p => {
      const appointment = p.appointment_id;
      return appointment && appointment.clientId ? appointment.clientId._id.toString() : null;
    });
    
    const uniqueClientIds = [...new Set(clientIds.filter(id => id !== null))];
    if (uniqueClientIds.length !== 1) {
      return res.status(400).json({
        success: false,
        message: 'All payments must belong to the same client'
      });
    }
    
    // Calculate combined totals
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalDiscount = payments.reduce((sum, p) => sum + p.discount, 0);
    const totalPayable = totalAmount - totalDiscount;
    
    // Get first payment's appointment (they can be from different appointments)
    // For combining, we'll link to the first appointment, but note that it's combined
    const firstPayment = payments[0];
    const appointmentIds = [...new Set(payments.map(p => p.appointment_id._id.toString()))];
    
    // Create combined payment
    const combinedPaymentData = {
      appointment_id: firstPayment.appointment_id._id,
      type: type,
      amount: totalAmount,
      discount: totalDiscount,
      payable_amount: totalPayable,
      status: payments.every(p => p.status === 'paid') ? 'paid' : 'pending',
      notes: `Combined payment from ${payments.length} payments. Appointments: ${appointmentIds.join(', ')}. ${notes || ''}`
    };
    
    const combinedPayment = await Payment.create(combinedPaymentData);
    
    // Update appointments - remove old payment IDs and add combined payment
    for (const payment of payments) {
      const appointment = await Appointment.findById(payment.appointment_id._id);
      if (appointment) {
        // Remove original payment
        appointment.payment_ids = appointment.payment_ids.filter(
          id => id.toString() !== payment._id.toString()
        );
        // Add combined payment if not already added
        if (!appointment.payment_ids.includes(combinedPayment._id)) {
          appointment.payment_ids.push(combinedPayment._id);
        }
        await appointment.save();
      }
    }
    
    // Delete original payments
    await Payment.deleteMany({ _id: { $in: payment_ids } });
    
    // Populate and return
    const populatedPayment = await Payment.findById(combinedPayment._id)
      .populate({
        path: 'appointment_id',
        populate: [
          { path: 'clientId', select: 'name phone email' },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price' },
          { path: 'staffId', select: 'name specialization' }
        ]
      });
    
    res.status(200).json({
      success: true,
      message: `Combined ${payments.length} payments into one`,
      data: populatedPayment
    });
  } catch (error) {
    console.error('combinePayments - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error combining payments',
      error: error.message
    });
  }
};

// @desc    Generate PDF bill
// @route   POST /api/payments/generate-bill
// @access  Public
const generateBill = async (req, res) => {
  try {
    const { payment_ids } = req.body;
    
    if (!payment_ids || !Array.isArray(payment_ids) || payment_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one payment ID is required'
      });
    }
    
    // Validate ObjectIds
    for (const id of payment_ids) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment ID: ${id}`
        });
      }
    }
    
    // Get payments with full details
    const payments = await Payment.find({ _id: { $in: payment_ids } })
      .populate({
        path: 'appointment_id',
        populate: [
          { 
            path: 'clientId', 
            select: 'name phone email address',
            populate: {
              path: 'membership_id',
              select: 'name discount_percent'
            }
          },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price' },
          { path: 'staffId', select: 'name specialization' }
        ]
      })
      .sort({ createdAt: 1 });
    
    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No payments found'
      });
    }
    
    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `bill-${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, fileName);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    
    // Business Information (you can customize this)
    doc.fontSize(20).text('GLAMOUR PRO', { align: 'center' });
    doc.fontSize(12).text('Beauty & Wellness Salon', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text('123 Beauty Street, City, Country', { align: 'center' });
    doc.text('Phone: +92 300 1234567 | Email: info@glamourpro.com', { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    
    // Bill Information
    doc.fontSize(16).text('BILL', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10);
    doc.text(`Bill Number: BILL-${Date.now()}`, { align: 'left' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();
    
    // Client Information
    const firstPayment = payments[0];
    const appointment = firstPayment && firstPayment.appointment_id ? firstPayment.appointment_id : null;
    const client = appointment && appointment.clientId ? appointment.clientId : null;
    
    if (client) {
      doc.fontSize(12).text('Client Information:', { underline: true });
      doc.fontSize(10);
      doc.text(`Name: ${client.name || 'N/A'}`);
      doc.text(`Phone: ${client.phone || 'N/A'}`);
      if (client.email) doc.text(`Email: ${client.email}`);
      if (client.address) doc.text(`Address: ${client.address}`);
      if (client.membership_id) {
        const membershipName = typeof client.membership_id === 'object' && client.membership_id.name
          ? client.membership_id.name
          : 'Member';
        doc.text(`Membership: ${membershipName}`);
      }
      doc.moveDown();
    }
    
    // Payment Details
    doc.fontSize(12).text('Payment Details:', { underline: true });
    doc.moveDown();
    
    let yPosition = doc.y;
    const tableTop = yPosition;
    const itemHeight = 20;
    
    // Table Header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Date', 50, yPosition);
    doc.text('Service', 120, yPosition);
    doc.text('Staff', 250, yPosition);
    doc.text('Amount', 350, yPosition, { width: 60, align: 'right' });
    doc.text('Discount', 420, yPosition, { width: 60, align: 'right' });
    doc.text('Payable', 490, yPosition, { width: 60, align: 'right' });
    yPosition += itemHeight;
    
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 5;
    
    // Table Rows
    doc.font('Helvetica');
    let totalAmount = 0;
    let totalDiscount = 0;
    let totalPayable = 0;
    
    for (const payment of payments) {
      const apt = payment && payment.appointment_id ? payment.appointment_id : null;
      const serviceVariation = apt && apt.serviceVariationId ? apt.serviceVariationId : null;
      const staff = apt && apt.staffId ? apt.staffId : null;
      const serviceName = serviceVariation && serviceVariation.variationName
        ? serviceVariation.variationName
        : 'N/A';
      const staffName = staff && staff.name ? staff.name : 'N/A';
      const paymentDate = payment.createdAt
        ? new Date(payment.createdAt).toLocaleDateString()
        : new Date().toLocaleDateString();
      
      doc.text(paymentDate, 50, yPosition);
      doc.text(serviceName, 120, yPosition, { width: 120 });
      doc.text(staffName, 250, yPosition, { width: 90 });
      doc.text(`PKR ${(payment.amount || 0).toFixed(2)}`, 350, yPosition, { width: 60, align: 'right' });
      doc.text(`PKR ${(payment.discount || 0).toFixed(2)}`, 420, yPosition, { width: 60, align: 'right' });
      doc.text(`PKR ${(payment.payable_amount || 0).toFixed(2)}`, 490, yPosition, { width: 60, align: 'right' });
      
      totalAmount += payment.amount || 0;
      totalDiscount += payment.discount || 0;
      totalPayable += payment.payable_amount || 0;
      
      yPosition += itemHeight;
      
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }
    }
    
    // Table Footer
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 10;
    
    doc.font('Helvetica-Bold');
    doc.text('Total Amount:', 350, yPosition, { width: 60, align: 'right' });
    doc.text(`PKR ${totalAmount.toFixed(2)}`, 420, yPosition, { width: 60, align: 'right' });
    yPosition += itemHeight;
    
    doc.text('Total Discount:', 350, yPosition, { width: 60, align: 'right' });
    doc.text(`PKR ${totalDiscount.toFixed(2)}`, 420, yPosition, { width: 60, align: 'right' });
    yPosition += itemHeight;
    
    doc.fontSize(12);
    doc.text('Total Payable:', 350, yPosition, { width: 60, align: 'right' });
    doc.text(`PKR ${totalPayable.toFixed(2)}`, 420, yPosition, { width: 60, align: 'right' });
    yPosition += itemHeight + 10;
    
    // Payment Method
    doc.fontSize(10).font('Helvetica');
    const paymentTypes = [...new Set(payments.map(p => p.type))];
    doc.text(`Payment Method(s): ${paymentTypes.join(', ')}`, 50, yPosition);
    yPosition += 20;
    
    // Footer
    doc.moveTo(50, doc.page.height - 100).lineTo(550, doc.page.height - 100).stroke();
    doc.fontSize(8).text('Thank you for your business!', { align: 'center' });
    doc.text('For inquiries, please contact us at info@glamourpro.com', { align: 'center' });
    
    doc.end();
    
    // Wait for PDF to be written
    stream.on('finish', async () => {
      // Mark payments as paid (optional - based on requirement)
      // We won't auto-mark as paid, user will do it separately
      
      res.status(200).json({
        success: true,
        message: 'Bill generated successfully',
        data: {
          fileName: fileName,
          filePath: `/uploads/${fileName}`,
          url: `/uploads/${fileName}`, // Direct URL to static file
          payments: payments.map(p => ({
            _id: p._id,
            amount: p.amount,
            discount: p.discount,
            payable_amount: p.payable_amount
          }))
        }
      });
    });
    
    stream.on('error', (error) => {
      console.error('PDF generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating PDF',
        error: error.message
      });
    });
  } catch (error) {
    console.error('generateBill - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating bill',
      error: error.message
    });
  }
};

// @desc    Download PDF bill
// @route   GET /api/payments/download-bill/:fileName
// @access  Public
const downloadBill = async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(uploadsDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Bill file not found'
      });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('downloadBill - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading bill',
      error: error.message
    });
  }
};

// @desc    Update payment status
// @route   PATCH /api/payments/:id/status
// @access  Public
const updatePaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    const { status } = req.body;
    
    if (!status || !['paid', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status (paid or pending) is required'
      });
    }
    
    payment.status = status;
    await payment.save();
    
    // Populate and return
    const populatedPayment = await Payment.findById(payment._id)
      .populate({
        path: 'appointment_id',
        populate: [
          { path: 'clientId', select: 'name phone email' },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price' },
          { path: 'staffId', select: 'name specialization' }
        ]
      });
    
    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status}`,
      data: populatedPayment
    });
  } catch (error) {
    console.error('updatePaymentStatus - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating payment status',
      error: error.message
    });
  }
};

// @desc    Get payments by client
// @route   GET /api/payments/client/:clientId
// @access  Public
const getPaymentsByClient = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { status, startDate, endDate } = req.query;
    
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client ID'
      });
    }
    
    // Find appointments for this client
    const appointments = await Appointment.find({ clientId }).select('_id');
    const appointmentIds = appointments.map(apt => apt._id);
    
    let query = { appointment_id: { $in: appointmentIds } };
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    
    const payments = await Payment.find(query)
      .populate({
        path: 'appointment_id',
        populate: [
          { path: 'clientId', select: 'name phone email' },
          { path: 'baseServiceId', select: 'name category' },
          { path: 'serviceVariationId', select: 'variationName timeDuration price' },
          { path: 'staffId', select: 'name specialization' }
        ]
      })
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    console.error('getPaymentsByClient - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments by client',
      error: error.message
    });
  }
};

module.exports = {
  getAllPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  splitPayment,
  combinePayments,
  generateBill,
  downloadBill,
  updatePaymentStatus,
  getPaymentsByClient
};

