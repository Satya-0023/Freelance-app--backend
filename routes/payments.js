const express = require('express');
const router = express.Router();

const { createCheckoutSession, verifyPayment, testStripeConfig } = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Test Stripe configuration
router.get('/test', protect, testStripeConfig);

// Create Stripe Checkout Session
router.post('/checkout-session', protect, createCheckoutSession);

// Verify payment
router.get('/verify/:sessionId', protect, verifyPayment);

// The webhook is handled directly in index.js to use express.raw()

module.exports = router; 