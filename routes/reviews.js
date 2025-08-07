const express = require('express');
const router = express.Router();

const {
  leaveReview,
  getGigReviews,
  getFreelancerReviews
} = require('../controllers/reviewController');

const { protect } = require('../middleware/auth');

// Leave a review (client only)
router.post('/', protect, leaveReview);

// Get all reviews for a gig
router.get('/gig/:gigId', getGigReviews);

// Get all reviews for a service (alias for gig)
router.get('/service/:serviceId', getGigReviews);

// Get all reviews for a freelancer
router.get('/freelancer/:freelancerId', getFreelancerReviews);

module.exports = router; 