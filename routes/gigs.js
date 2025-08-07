const express = require('express');
const router = express.Router();
const Gig = require('../models/Gig');

const {
  createGig,
  getGigs,
  getGigById,
  updateGig,
  deleteGig
} = require('../controllers/gigController');

const { protect, freelancer } = require('../middleware/authMiddleware');

// ───── PUBLIC ROUTES ─────
router.get('/', getGigs);           // Get all gigs (with optional filters or pagination)
router.get('/:id', getGigById);     // Get gig by ID

// ───── PROTECTED ROUTES ─────

// Create a new gig (freelancers only)
router.post('/', protect, freelancer, createGig);

// Get gigs created by the logged-in freelancer
router.get('/my-gigs', protect, freelancer, async (req, res) => {
  try {
    const gigs = await Gig.find({ user: req.user._id }).populate('user', 'username profile.firstName profile.lastName');
    res.status(200).json({
      success: true,
      data: gigs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your gigs.',
      error: error.message
    });
  }
});

// Update a gig
router.put('/:id', protect, freelancer, updateGig);

// Delete a gig
router.delete('/:id', protect, freelancer, deleteGig);

module.exports = router;
