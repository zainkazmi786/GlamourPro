const express = require('express');
const router = express.Router();
const {
  createClosure,
  getAllClosures,
  deleteClosure
} = require('../controllers/companyClosureController');
const { protect } = require('../middleware/authMiddleware');

// All company closure routes are protected
router.use(protect);

router.route('/')
  .get(getAllClosures)
  .post(createClosure);

router.delete('/:id', deleteClosure);

module.exports = router;




