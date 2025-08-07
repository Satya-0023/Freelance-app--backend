const User = require('../models/User');

// @desc    Get user profile by ID
// @route   GET /api/users/:id
// @access  Public
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: user.getPublicProfile()
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
};

// @desc    Search users (freelancers)
// @route   GET /api/users/search
// @access  Public
const searchUsers = async (req, res) => {
  try {
    const { 
      q, // search query
      skills, // skills filter
      minRate, // minimum hourly rate
      maxRate, // maximum hourly rate
      location, // location filter
      page = 1,
      limit = 10
    } = req.query;

    // Build search query
    const searchQuery = {
      role: 'freelancer',
      isActive: true
    };

    // Text search
    if (q) {
      searchQuery.$or = [
        { username: { $regex: q, $options: 'i' } },
        { 'profile.firstName': { $regex: q, $options: 'i' } },
        { 'profile.lastName': { $regex: q, $options: 'i' } },
        { 'profile.bio': { $regex: q, $options: 'i' } }
      ];
    }

    // Skills filter
    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      searchQuery['profile.skills'] = { $in: skillsArray };
    }

    // Rate filter
    if (minRate || maxRate) {
      searchQuery['profile.hourlyRate'] = {};
      if (minRate) searchQuery['profile.hourlyRate'].$gte = parseFloat(minRate);
      if (maxRate) searchQuery['profile.hourlyRate'].$lte = parseFloat(maxRate);
    }

    // Location filter
    if (location) {
      searchQuery['profile.location'] = { $regex: location, $options: 'i' };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const users = await User.find(searchQuery)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(searchQuery);

    res.json({
      success: true,
      data: {
        users: users.map(user => user.getPublicProfile()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching users',
      error: error.message
    });
  }
};

// @desc    Get top freelancers
// @route   GET /api/users/top-freelancers
// @access  Public
const getTopFreelancers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // In a real app, you'd calculate this based on reviews, orders, etc.
    // For now, we'll just get the most recent freelancers
    const freelancers = await User.find({
      role: 'freelancer',
      isActive: true
    })
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: {
        freelancers: freelancers.map(user => user.getPublicProfile())
      }
    });

  } catch (error) {
    console.error('Get top freelancers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching top freelancers',
      error: error.message
    });
  }
};

// @desc    Get user statistics
// @route   GET /api/users/:id/stats
// @access  Public
const getUserStats = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // In a real app, you'd calculate these from orders, reviews, etc.
    const stats = {
      totalOrders: 0,
      completedOrders: 0,
      averageRating: 0,
      totalReviews: 0,
      totalEarnings: 0,
      responseRate: 100,
      responseTime: '1 hour'
    };

    res.json({
      success: true,
      data: {
        stats
      }
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};

module.exports = {
  getUserProfile,
  searchUsers,
  getTopFreelancers,
  getUserStats
}; 