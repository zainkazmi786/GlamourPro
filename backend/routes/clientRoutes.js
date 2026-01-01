const express = require('express');
const router = express.Router();
const {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  resetClientSessions,
  getClientPointsHistory,
  getClientByRFID
} = require('../controllers/clientController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Client routes - Only Receptionist and Manager can access
// Therapist should not have access to client personal data
router.route('/')
  .get(authorize('receptionist', 'manager'), getAllClients)
  .post(authorize('receptionist', 'manager'), createClient);

router.route('/rfid/:rfidNumber')
  .get(authorize('receptionist', 'manager'), getClientByRFID);

router.route('/:id')
  .get(authorize('receptionist', 'manager'), getClientById)
  .put(authorize('receptionist', 'manager'), updateClient)
  .delete(authorize('manager'), deleteClient); // Only Manager can delete

router.route('/:id/reset-sessions')
  .post(authorize('receptionist', 'manager'), resetClientSessions);

router.route('/:id/points-history')
  .get(authorize('receptionist', 'manager'), getClientPointsHistory);

module.exports = router;

