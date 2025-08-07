const Review = require('../models/Review');
const Order = require('../models/Order');
const Gig = require('../models/Gig');
const User = require('../models/User');

// @desc    Leave a review (client, after order completion)
// @route   POST /api/reviews
// @access  Private (client only)
exports.leaveReview = async (req, res) => {
  try {
    const { gigId, orderId, rating, comment } = req.body;
    const reviewerId = req.user._id;

    // Only clients can review
    if (req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only clients can leave reviews' });
    }

    // Check order is completed and belongs to this client
    const order = await Order.findById(orderId);
    if (!order || order.buyer.toString() !== reviewerId.toString() || order.gig.toString() !== gigId || order.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'You can only review completed orders you purchased' });
    }

    // Prevent duplicate reviews
    const existing = await Review.findOne({ gig: gigId, reviewer: reviewerId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this gig' });
    }

    // Get freelancer (seller)
    const gig = await Gig.findById(gigId);
    if (!gig) {
      return res.status(404).json({ success: false, message: 'Gig not found' });
    }
    const freelancerId = gig.user;

    // Create review
    const review = await Review.create({
      gig: gigId,
      order: orderId,
      reviewer: reviewerId,
      freelancer: freelancerId,
      rating,
      comment
    });

    // Update gig's average rating and numReviews
    const reviews = await Review.find({ gig: gigId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    gig.rating = avgRating;
    gig.numReviews = reviews.length;
    await gig.save();

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    console.error('Leave review error:', error);
    res.status(500).json({ success: false, message: 'Error leaving review', error: error.message });
  }
};

// @desc    Get all reviews for a gig
// @route   GET /api/reviews/gig/:gigId
// @access  Public
exports.getGigReviews = async (req, res) => {
  try {
    const { gigId } = req.params;
    const reviews = await Review.find({ gig: gigId })
      .populate('reviewer', 'username profile.avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (error) {
    console.error('Get gig reviews error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews', error: error.message });
  }
};

// @desc    Get all reviews for a freelancer
// @route   GET /api/reviews/freelancer/:freelancerId
// @access  Public
exports.getFreelancerReviews = async (req, res) => {
  try {
    const { freelancerId } = req.params;
    const reviews = await Review.find({ freelancer: freelancerId })
      .populate('reviewer', 'username profile.avatar')
      .populate('gig', 'title')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (error) {
    console.error('Get freelancer reviews error:', error);
    res.status(500).json({ success: false, message: 'Error fetching reviews', error: error.message });
  }
}; 