const Stripe = require('stripe');
const Gig = require('../models/Gig');
const User = require('../models/User');
const Order = require('../models/Order');

// Check if Stripe is configured
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is not configured in environment variables');
}

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

// @desc    Test Stripe configuration
// @route   GET /api/payments/test
// @access  Private
exports.testStripeConfig = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Stripe is not configured',
        configured: false,
        error: 'STRIPE_SECRET_KEY is missing from environment variables'
      });
    }

    // Test Stripe connection by creating a test session
    const testSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Product',
              description: 'Test Description',
            },
            unit_amount: 1000, // $10.00
          },
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:5173/payment-success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:5173/payment-cancelled',
    });

    res.json({
      success: true,
      message: 'Stripe is configured correctly',
      configured: true,
      testSessionId: testSession.id
    });
  } catch (error) {
    console.error('Stripe test error:', error);
    res.status(500).json({
      success: false,
      message: 'Stripe configuration test failed',
      configured: false,
      error: error.message
    });
  }
};

// @desc    Create Stripe Checkout Session
// @route   POST /api/payments/checkout-session
// @access  Private (client only)
exports.createCheckoutSession = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      // For development/testing, create a mock order
      if (process.env.NODE_ENV === 'development') {
        const { gigId, requirements } = req.body;
        const gig = await Gig.findById(gigId).populate('user');
        
        if (!gig) {
          return res.status(404).json({ success: false, message: 'Gig not found' });
        }

        // Create order directly (for testing) with In Progress status
        const order = await Order.create({
          gig: gig._id,
          buyer: req.user._id,
          seller: gig.user._id,
          price: gig.price,
          requirements: requirements || '',
          status: 'In Progress'
        });

        return res.json({ 
          success: true, 
          message: 'Test order created (Stripe not configured)',
          orderId: order._id,
          url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment-success?session_id=test_${order._id}`
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'Payment system is not configured. Please contact support.' 
      });
    }

    if (req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only clients can pay for gigs' });
    }
    
    const { gigId, requirements } = req.body;
    
    if (!gigId) {
      return res.status(400).json({ success: false, message: 'Gig ID is required' });
    }

    const gig = await Gig.findById(gigId).populate('user');
    if (!gig || !gig.isActive) {
      return res.status(404).json({ success: false, message: 'Gig not found' });
    }
    
    if (gig.user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot buy your own gig' });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: gig.title,
              description: gig.description,
            },
            unit_amount: Math.round(gig.price * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: req.user.email,
      metadata: {
        gigId: gig._id.toString(),
        buyerId: req.user._id.toString(),
        sellerId: gig.user._id.toString(),
        requirements: requirements || ''
      },
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment-cancelled`,
    });

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Stripe checkout session error:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Error creating payment session';
    if (error.type === 'StripeInvalidRequestError') {
      errorMessage = 'Invalid payment configuration';
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Payment system authentication failed';
    } else if (error.type === 'StripePermissionError') {
      errorMessage = 'Payment system permission denied';
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage, 
      error: error.message 
    });
  }
};

// Stripe webhook handler
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = require('stripe')(process.env.STRIPE_SECRET_KEY).webhooks.constructEvent(
      req.body, // Use req.body instead of req.rawBody
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      // Prevent duplicate orders
      const existing = await Order.findOne({
        gig: session.metadata.gigId,
        buyer: session.metadata.buyerId,
        seller: session.metadata.sellerId,
        price: session.amount_total / 100
      });
      if (existing) {
        return res.status(200).json({ received: true, message: 'Order already exists' });
      }
      // Create order with "In Progress" status since payment is completed
      await Order.create({
        gig: session.metadata.gigId,
        buyer: session.metadata.buyerId,
        seller: session.metadata.sellerId,
        price: session.amount_total / 100,
        requirements: session.metadata.requirements || '',
        status: 'In Progress'
      });
      console.log('Order created from Stripe webhook with In Progress status');
    } catch (err) {
      console.error('Error creating order from Stripe webhook:', err);
      return res.status(500).json({ error: 'Error creating order' });
    }
  }
  res.status(200).json({ received: true });
};

// @desc    Verify payment session
// @route   GET /api/payments/verify/:sessionId
// @access  Private
exports.verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Handle test sessions (development mode)
    if (sessionId.startsWith('test_')) {
      const orderId = sessionId.replace('test_', '');
      const order = await Order.findById(orderId).populate('gig');
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Test order not found'
        });
      }
      
      // Update order status to "In Progress" for test orders
      if (order.status === 'Pending') {
        order.status = 'In Progress';
        await order.save();
      }
      
      return res.json({
        success: true,
        data: order
      });
    }
    
    // Handle real Stripe sessions
    if (!stripe) {
      return res.status(500).json({
        success: false,
        message: 'Stripe is not configured'
      });
    }
    
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Payment session not found'
      });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // Find the order created from this session
    const order = await Order.findOne({
      gig: session.metadata.gigId,
      buyer: session.metadata.buyerId,
      seller: session.metadata.sellerId,
      price: session.amount_total / 100
    }).populate('gig');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order status to "In Progress" after successful payment verification
    if (order.status === 'Pending') {
      order.status = 'In Progress';
      await order.save();
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
    });
  }
}; 