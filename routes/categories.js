const express = require('express');
const router = express.Router();

// Example: GET /api/categories
router.get('/', async (req, res) => {
  res.json([
    { id: '1', name: 'Graphics & Design', slug: 'graphics-design', icon: '🎨', subcategories: [] },
    { id: '2', name: 'Programming & Tech', slug: 'programming-tech', icon: '💻', subcategories: [] },
    { id: '3', name: 'Digital Marketing', slug: 'digital-marketing', icon: '📱', subcategories: [] },
    { id: '4', name: 'Writing & Translation', slug: 'writing-translation', icon: '✍️', subcategories: [] },
    { id: '5', name: 'Video & Animation', slug: 'video-animation', icon: '🎬', subcategories: [] },
    { id: '6', name: 'Music & Audio', slug: 'music-audio', icon: '🎵', subcategories: [] }
  ]);
});

module.exports = router; 