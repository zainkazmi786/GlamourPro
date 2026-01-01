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
const { protect, authorize } = require('../middleware/authMiddleware');

// All payment routes require authentication
router.use(protect);

// POS/Payment routes - Only Receptionist and Manager can access
router.get('/', authorize('receptionist', 'manager'), getAllPayments);
router.get('/client/:clientId', authorize('receptionist', 'manager'), getPaymentsByClient);
router.get('/:id', authorize('receptionist', 'manager'), getPaymentById);
router.post('/', authorize('receptionist', 'manager'), createPayment);
router.put('/:id', authorize('receptionist', 'manager'), updatePayment);
router.delete('/:id', authorize('receptionist', 'manager'), deletePayment); // Manager and Receptionist can delete
router.post('/:id/split', authorize('receptionist', 'manager'), splitPayment);
router.post('/combine', authorize('receptionist', 'manager'), combinePayments);
router.post('/generate-bill', authorize('receptionist', 'manager'), generateBill);
router.get('/download-bill/:fileName', authorize('receptionist', 'manager'), downloadBill);
router.patch('/:id/status', authorize('receptionist', 'manager'), updatePaymentStatus);

module.exports = router;








