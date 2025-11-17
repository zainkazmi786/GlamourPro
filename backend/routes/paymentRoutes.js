const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/paymentController');

// @route   GET /api/payments
// @desc    Get all payments
// @access  Public
router.get('/', getAllPayments);

// @route   GET /api/payments/client/:clientId
// @desc    Get payments by client
// @access  Public
router.get('/client/:clientId', getPaymentsByClient);

// @route   GET /api/payments/:id
// @desc    Get single payment by ID
// @access  Public
router.get('/:id', getPaymentById);

// @route   POST /api/payments
// @desc    Create new payment
// @access  Public
router.post('/', createPayment);

// @route   PUT /api/payments/:id
// @desc    Update payment
// @access  Public
router.put('/:id', updatePayment);

// @route   DELETE /api/payments/:id
// @desc    Delete payment
// @access  Public
router.delete('/:id', deletePayment);

// @route   POST /api/payments/:id/split
// @desc    Split payment into multiple payments
// @access  Public
router.post('/:id/split', splitPayment);

// @route   POST /api/payments/combine
// @desc    Combine multiple payments into one
// @access  Public
router.post('/combine', combinePayments);

// @route   POST /api/payments/generate-bill
// @desc    Generate PDF bill for payments
// @access  Public
router.post('/generate-bill', generateBill);

// @route   GET /api/payments/download-bill/:fileName
// @desc    Download PDF bill
// @access  Public
router.get('/download-bill/:fileName', downloadBill);

// @route   PATCH /api/payments/:id/status
// @desc    Update payment status
// @access  Public
router.patch('/:id/status', updatePaymentStatus);

module.exports = router;




