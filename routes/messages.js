const express = require('express');
const router = express.Router();

const {
  sendMessage,
  getMessages,
  getMessagesByConversation,
  getConversations,
  getFreelancers,
  getMessagesByOrder
} = require('../controllers/messageController');

const { protect } = require('../middleware/auth');

// Send a new message
router.post('/', protect, sendMessage);

// Get all conversations for current user (must come before /:userId)
router.get('/conversations', protect, getConversations);

// Get available freelancers for messaging (must come before /:userId)
router.get('/freelancers', protect, getFreelancers);

// Get messages by conversation ID (must come before /:userId)
router.get('/conversation/:conversationId', protect, getMessagesByConversation);

// Get messages by order ID (must come before /:userId)
router.get('/order/:orderId', protect, getMessagesByOrder);

// Get messages for a conversation with another user
router.get('/:userId', protect, getMessages);

module.exports = router; 