const express = require('express');
const router = express.Router();
const {
  registerClient,
  loginClient,
  getClientProfile,
  updateClientPassword
} = require('../controllers/clientAuthController');
const { clientAuth } = require('../middleware/clientAuth');
const PointsHistory = require('../models/PointsHistory');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Client = require('../models/Client');

// Public routes
// Add a test route to verify routing works
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Client portal routes are working' });
});

// Log middleware to debug route access
router.use((req, res, next) => {
  console.log(`[Client Portal Route] ${req.method} ${req.path}`, {
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url
  });
  next();
});

router.post('/register', registerClient);
router.post('/login', loginClient);

// Protected routes
router.get('/profile', clientAuth, getClientProfile);
router.put('/password', clientAuth, updateClientPassword);

// @desc    Get client points history
// @route   GET /api/client-portal/points-history
// @access  Private (client)
router.get('/points-history', clientAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const pointsHistory = await PointsHistory.find({ clientId: req.client.id })
      .populate('appointmentId', 'startTime serviceVariationId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const total = await PointsHistory.countDocuments({ clientId: req.client.id });

    res.status(200).json({
      success: true,
      data: pointsHistory,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('getClientPointsHistory - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching points history',
      error: error.message
    });
  }
});

// @desc    Get client appointments
// @route   GET /api/client-portal/appointments
// @access  Private (client)
router.get('/appointments', clientAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const query = { clientId: req.client.id };
    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate('baseServiceId', 'name category')
      .populate('serviceVariationId', 'variationName timeDuration price')
      .populate('staffId', 'name specialization')
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const total = await Appointment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: appointments,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('getClientAppointments - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message
    });
  }
});

// @desc    Get client payments/billing history
// @route   GET /api/client-portal/payments
// @access  Private (client)
router.get('/payments', clientAuth, async (req, res) => {
  try {
    // Get all appointments for this client
    const appointments = await Appointment.find({ clientId: req.client.id })
      .select('_id payment_ids')
      .lean();

    const appointmentIds = appointments.map(apt => apt._id);
    const paymentIds = appointments.flatMap(apt => apt.payment_ids || []);

    if (paymentIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          pages: 0
        }
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const payments = await Payment.find({ _id: { $in: paymentIds } })
      .populate('appointment_id', 'startTime baseServiceId serviceVariationId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const total = await Payment.countDocuments({ _id: { $in: paymentIds } });

    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error('getClientPayments - Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message
    });
  }
});

module.exports = router;
