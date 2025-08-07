const Order = require('../models/Order');
const Gig = require('../models/Gig');
const User = require('../models/User');

// @desc    Place an order (client buys a gig)
// @route   POST /api/orders
// @access  Private (client only)
exports.placeOrder = async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ success: false, message: 'Only clients can place orders' });
    }
    const { gigId, requirements } = req.body;
    const gig = await Gig.findById(gigId);
    if (!gig || !gig.isActive) {
      return res.status(404).json({ success: false, message: 'Gig not found' });
    }
    // Prevent buying own gig
    if (gig.user.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot buy your own gig' });
    }
    const seller = await User.findById(gig.user);
    const order = await Order.create({
      gig: gig._id,
      buyer: req.user._id,
      seller: seller._id,
      price: gig.price,
      requirements: requirements || ''
    });
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ success: false, message: 'Error placing order', error: error.message });
  }
};

// @desc    Get all orders for current user (buyer or seller)
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res) => {
  try {
    const filter = {
      $or: [
        { buyer: req.user._id },
        { seller: req.user._id }
      ]
    };
    const orders = await Order.find(filter)
      .populate('gig', 'title price category')
      .populate('buyer', 'username profile.firstName profile.lastName')
      .populate('seller', 'username profile.firstName profile.lastName')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Error fetching orders', error: error.message });
  }
};

// @desc    Get a single order by ID (buyer or seller only)
// @route   GET /api/orders/:id
// @access  Private
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('gig', 'title price category')
      .populate('buyer', 'username profile.firstName profile.lastName')
      .populate('seller', 'username profile.firstName profile.lastName');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Only buyer or seller can view
    const isBuyer = order.buyer._id.toString() === req.user._id.toString();
    const isSeller = order.seller._id.toString() === req.user._id.toString();
    
    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Get order by id error:', error);
    res.status(500).json({ success: false, message: 'Error fetching order', error: error.message });
  }
};

// @desc    Update order status (seller only)
// @route   PUT /api/orders/:id/status
// @access  Private (seller only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    // Only seller can update
    if (order.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this order' });
    }
    // Only allow valid status transitions
    const validStatuses = ['In Progress', 'Delivered', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    order.status = status;
    if (status === 'Delivered') order.deliveredAt = new Date();
    if (status === 'Completed') order.completedAt = new Date();
    if (status === 'Cancelled') order.cancelledAt = new Date();
    await order.save();
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Error updating order status', error: error.message });
  }
}; 