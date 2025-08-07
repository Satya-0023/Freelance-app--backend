const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, orderId } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !content) {
      return res.status(400).json({ success: false, message: 'Receiver and content are required' });
    }

    // Create a consistent conversation ID
    const conversationId = [senderId, receiverId].sort().join('_');

    const message = await Message.create({
      conversationId,
      sender: senderId,
      receiver: receiverId,
      content,
      orderId: orderId || null
    });

    // Populate sender info for response
    await message.populate('sender', 'username profile.firstName profile.lastName profile.avatar');

    res.status(201).json({ 
      success: true, 
      data: {
        id: message._id,
        senderId: message.sender._id,
        receiverId: message.receiver,
        content: message.content,
        timestamp: message.createdAt,
        senderName: `${message.sender.profile.firstName} ${message.sender.profile.lastName}`
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Error sending message', error: error.message });
  }
};

// @desc    Get all messages for a conversation
// @route   GET /api/messages/:userId
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const selfId = req.user._id;

    const conversationId = [selfId, userId].sort().join('_');

    const messages = await Message.find({ conversationId })
      .populate('sender', 'username profile.firstName profile.lastName profile.avatar')
      .populate('receiver', 'username profile.firstName profile.lastName profile.avatar')
      .sort({ createdAt: 'asc' });

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages', error: error.message });
  }
};

// @desc    Get messages by conversation ID
// @route   GET /api/messages/conversation/:conversationId
// @access  Private
exports.getMessagesByConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const selfId = req.user._id;

    // Verify user is part of this conversation
    const messages = await Message.find({ conversationId })
      .populate('sender', 'username profile.firstName profile.lastName profile.avatar')
      .populate('receiver', 'username profile.firstName profile.lastName profile.avatar')
      .sort({ createdAt: 'asc' });

    // Check if user is part of this conversation
    const isParticipant = messages.some(msg => 
      msg.sender._id.toString() === selfId.toString() || 
      msg.receiver._id.toString() === selfId.toString()
    );

    if (!isParticipant && messages.length > 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to view this conversation' 
      });
    }

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get messages by conversation error:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages', error: error.message });
  }
};

// @desc    Get messages by order ID
// @route   GET /api/messages/order/:orderId
// @access  Private
exports.getMessagesByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Get messages for this order
    const messages = await Message.find({ orderId })
      .populate('sender', 'username profile.firstName profile.lastName profile.avatar')
      .populate('receiver', 'username profile.firstName profile.lastName profile.avatar')
      .sort({ createdAt: 'asc' });

    // Format messages for frontend
    const formattedMessages = messages.map(message => ({
      id: message._id,
      senderId: message.sender._id,
      receiverId: message.receiver._id,
      content: message.content,
      timestamp: message.createdAt,
      senderName: `${message.sender.profile.firstName} ${message.sender.profile.lastName}`
    }));

    res.json({ 
      success: true, 
      messages: formattedMessages 
    });
  } catch (error) {
    console.error('Get messages by order error:', error);
    res.status(500).json({ success: false, message: 'Error fetching messages', error: error.message });
  }
};

// @desc    Get all conversations for current user
// @route   GET /api/messages/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all messages where user is sender or receiver
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }]
    }).populate('sender', 'username profile.firstName profile.lastName profile.avatar')
      .populate('receiver', 'username profile.firstName profile.lastName profile.avatar')
      .sort({ createdAt: 'desc' });

    // Group messages by conversation
    const conversations = {};
    messages.forEach(message => {
      const conversationId = message.conversationId;
      const otherUserId = message.sender._id.toString() === userId.toString() 
        ? message.receiver._id 
        : message.sender._id;
      
      if (!conversations[conversationId]) {
        // Determine which participant is the current user and which is the other person
        const isCurrentUserSender = message.sender._id.toString() === userId.toString();
        const currentUser = isCurrentUserSender ? message.sender : message.receiver;
        const otherUser = isCurrentUserSender ? message.receiver : message.sender;
        
        conversations[conversationId] = {
          id: conversationId,
          participants: [
            {
              id: currentUser._id,
              username: currentUser.username,
              firstName: currentUser.profile?.firstName,
              lastName: currentUser.profile?.lastName,
              avatar: currentUser.profile?.avatar,
              role: currentUser.role
            },
            {
              id: otherUser._id,
              username: otherUser.username,
              firstName: otherUser.profile?.firstName,
              lastName: otherUser.profile?.lastName,
              avatar: otherUser.profile?.avatar,
              role: otherUser.role
            }
          ],
          lastMessage: {
            content: message.content,
            timestamp: message.createdAt,
            senderId: message.sender._id
          },
          unreadCount: 0 // TODO: Implement unread count
        };
      }
    });

    const conversationsList = Object.values(conversations);
    res.json({ success: true, data: conversationsList });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, message: 'Error fetching conversations', error: error.message });
  }
};

// @desc    Get available freelancers for messaging
// @route   GET /api/messages/freelancers
// @access  Private
exports.getFreelancers = async (req, res) => {
  try {
    const freelancers = await User.find({ 
      role: 'freelancer',
      isActive: true 
    }).select('username email profile.firstName profile.lastName profile.avatar role');

    const freelancersList = freelancers.map(user => ({
      id: user._id,
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      email: user.email,
      role: user.role,
      avatar: user.profile?.avatar
    }));

    res.json({ success: true, data: freelancersList });
  } catch (error) {
    console.error('Get freelancers error:', error);
    res.status(500).json({ success: false, message: 'Error fetching freelancers', error: error.message });
  }
}; 