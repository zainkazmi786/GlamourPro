const express = require('express');
const router = express.Router();
const {
  calculateMonthlySalary,
  getAllMonthlySalaries,
  getMonthlySalaryById,
  getMonthlySalariesByStaff,
  updateMonthlySalary,
  bulkDeleteMonthlySalaries
} = require('../controllers/monthlySalaryController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All salary routes are protected
router.use(protect);

// Salary routes - Only Receptionist and Manager can access
router.use(authorize('receptionist', 'manager'));

router.post('/calculate', calculateMonthlySalary);

router.route('/')
  .get(getAllMonthlySalaries);

router.get('/staff/:staffId', getMonthlySalariesByStaff);
router.delete('/bulk', bulkDeleteMonthlySalaries);

router.route('/:id')
  .get(getMonthlySalaryById)
  .put(updateMonthlySalary);

module.exports = router;







