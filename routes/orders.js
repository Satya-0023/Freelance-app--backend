const express = require('express');
const router = express.Router();

const {
  placeOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
} = require('../controllers/orderController');

const { protect } = require('../middleware/auth');

// Place an order (client only)
router.post('/', protect, placeOrder);

// Get all orders for current user (buyer or seller)
router.get('/', protect, getOrders);

// Get a single order (buyer or seller)
router.get('/:id', protect, getOrderById);

// Update order status (seller only)
router.put('/:id/status', protect, updateOrderStatus);

module.exports = router; 