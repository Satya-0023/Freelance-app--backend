const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Gig = require('../models/Gig');
const Order = require('../models/Order');

// @desc    Get admin statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalGigs = await Gig.countDocuments();
    const totalOrders = await Order.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const pendingOrders = await Order.countDocuments({ status: 'Pending' });

    // Calculate total revenue
    const completedOrders = await Order.find({ status: 'Completed' });
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.price, 0);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalGigs,
        totalOrders,
        totalRevenue,
        activeUsers,
        pendingOrders
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin stats',
      error: error.message
    });
  }
});

// @desc    Get all users (admin only)
// @route   GET /api/admin/users
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// @desc    Delete user (admin only)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
router.delete('/users/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
});

// @desc    Bulk delete users (admin only)
// @route   DELETE /api/admin/users/bulk
// @access  Private/Admin
router.delete('/users/bulk', protect, admin, async (req, res) => {
  try {
    const { criteria, force } = req.body;
    
    // Safety check - require force flag for bulk deletion
    if (!force) {
      return res.status(400).json({
        success: false,
        message: 'Bulk deletion requires force=true parameter for safety'
      });
    }
    
    let deleteCriteria = {};
    
    // Handle different criteria
    if (criteria) {
      if (criteria.role) {
        deleteCriteria.role = criteria.role;
      }
      if (criteria.isActive !== undefined) {
        deleteCriteria.isActive = criteria.isActive;
      }
      if (criteria.isVerified !== undefined) {
        deleteCriteria.isVerified = criteria.isVerified;
      }
      if (criteria.daysInactive) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - criteria.daysInactive);
        deleteCriteria.lastLogin = { $lt: cutoffDate };
      }
    }
    
    // If no specific criteria, delete all users (with extra confirmation)
    if (Object.keys(deleteCriteria).length === 0) {
      const totalUsers = await User.countDocuments();
      if (totalUsers > 0) {
        console.log(`⚠️  ADMIN BULK DELETE: Deleting all ${totalUsers} users`);
      }
    }
    
    const result = await User.deleteMany(deleteCriteria);
    
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} users`,
      deletedCount: result.deletedCount
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error performing bulk deletion',
      error: error.message
    });
  }
});

module.exports = router; 