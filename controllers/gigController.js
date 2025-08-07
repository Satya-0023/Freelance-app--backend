const Gig = require('../models/Gig');
const User = require('../models/User');

// @desc    Create a new gig
// @route   POST /api/gigs
// @access  Private (freelancer only)
exports.createGig = async (req, res) => {
  try {
    console.log('🎯 Creating gig...');
    console.log('User:', req.user._id);
    console.log('Request body:', req.body);

    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ success: false, message: 'Only freelancers can create gigs' });
    }

    const tags = typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags;
    const images = typeof req.body.images === 'string' ? JSON.parse(req.body.images) : req.body.images;
    const { title, description, category, price, deliveryTime } = req.body;

    const existing = await Gig.findOne({ user: req.user._id, title });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Gig with same title already exists' });
    }

    const gig = await Gig.create({
      user: req.user._id,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      price,
      deliveryTime,
      images: images || [],
      tags: tags || []
    });

    res.status(201).json({ success: true, data: gig });
  } catch (error) {
    console.error('Create gig error:', error);
    res.status(500).json({ success: false, message: 'Error creating gig', error: error.message });
  }
};

// @desc    Get all gigs (with optional filters)
// @route   GET /api/gigs
// @access  Public
exports.getGigs = async (req, res) => {
  try {
    const { q, category, minPrice, maxPrice, user, minRating, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;
    const filter = { isActive: true };

    if (q) filter.$text = { $search: q };
    if (category) filter.category = category;
    if (user) filter.user = user;
    if (minRating) filter.rating = { $gte: parseFloat(minRating) };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const gigs = await Gig.find(filter)
      .populate('user', 'username profile.firstName profile.lastName profile.avatar')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await Gig.countDocuments(filter);

    res.json({
      success: true,
      data: {
        gigs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get gigs error:', error);
    res.status(500).json({ success: false, message: 'Error fetching gigs', error: error.message });
  }
};

// @desc    Get a single gig by ID
// @route   GET /api/gigs/:id
// @access  Public
exports.getGigById = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id)
      .populate('user', 'username profile.firstName profile.lastName profile.avatar');
    if (!gig || !gig.isActive) {
      return res.status(404).json({ success: false, message: 'Gig not found' });
    }
    res.json({ success: true, data: gig });
  } catch (error) {
    console.error('Get gig by id error:', error);
    res.status(500).json({ success: false, message: 'Error fetching gig', error: error.message });
  }
};

// @desc    Update a gig
// @route   PUT /api/gigs/:id
// @access  Private (freelancer only, owner)
exports.updateGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig || !gig.isActive) {
      return res.status(404).json({ success: false, message: 'Gig not found' });
    }
    if (gig.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this gig' });
    }
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ success: false, message: 'Only freelancers can update gigs' });
    }

    const fields = ['title', 'description', 'category', 'price', 'deliveryTime', 'images', 'tags'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) gig[field] = req.body[field];
    });

    await gig.save();
    res.json({ success: true, data: gig });
  } catch (error) {
    console.error('Update gig error:', error);
    res.status(500).json({ success: false, message: 'Error updating gig', error: error.message });
  }
};

// @desc    Delete a gig
// @route   DELETE /api/gigs/:id
// @access  Private (freelancer only, owner)
exports.deleteGig = async (req, res) => {
  try {
    const gig = await Gig.findById(req.params.id);
    if (!gig || !gig.isActive) {
      return res.status(404).json({ success: false, message: 'Gig not found' });
    }
    if (gig.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this gig' });
    }
    if (req.user.role !== 'freelancer') {
      return res.status(403).json({ success: false, message: 'Only freelancers can delete gigs' });
    }

    gig.isActive = false;
    await gig.save();
    res.json({ success: true, message: 'Gig deleted successfully' });
  } catch (error) {
    console.error('Delete gig error:', error);
    res.status(500).json({ success: false, message: 'Error deleting gig', error: error.message });
  }
};