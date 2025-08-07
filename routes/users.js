const express = require('express');
const router = express.Router();

// Import controller
const {
  getUserProfile,
  searchUsers,
  getTopFreelancers,
  getUserStats
} = require('../controllers/userController');

// Public routes
router.get('/search', searchUsers);
router.get('/top-freelancers', getTopFreelancers);
router.get('/:id', getUserProfile);
router.get('/:id/stats', getUserStats);

module.exports = router; 