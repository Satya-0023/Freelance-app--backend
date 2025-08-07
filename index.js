const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
require('dotenv').config();
const { Server } = require("socket.io");

// Import database connection
const connectDB = require('./config/database');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: [process.env.CORS_ORIGIN || 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Stripe webhook needs raw body
// IMPORTANT: This must come BEFORE express.json()
app.post('/api/payments/webhook', express.raw({type: 'application/json'}), require('./controllers/paymentController').stripeWebhook);

// Body parser middleware (for all other routes)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware (disabled for cleaner output)
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

// Health check route
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/gigs', require('./routes/gigs'));
app.use('/api/services', require('./routes/gigs')); // Alias for frontend compatibility
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: [process.env.CORS_ORIGIN || "http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

let onlineUsers = [];
let orderRooms = new Map(); // Track users in order rooms

const addUser = (userId, socketId) => {
  const existingUser = onlineUsers.find(user => user.userId === userId);
  if (existingUser) {
    existingUser.socketId = socketId;
  } else {
    onlineUsers.push({ userId, socketId });
    // Emit userOnline event to all clients
    io.emit('userOnline', userId);
  }
  // console.log(`User ${userId} added to online list. Total online: ${onlineUsers.length}`);
};

const removeUser = (socketId) => {
  const user = onlineUsers.find(user => user.socketId === socketId);
  if (user) {
    // Emit userOffline event to all clients
    io.emit('userOffline', user.userId);
    onlineUsers = onlineUsers.filter(user => user.socketId !== socketId);
    // console.log(`User ${user.userId} removed from online list. Total online: ${onlineUsers.length}`);
  }
};

const getUser = (userId) => {
  return onlineUsers.find(user => user.userId === userId);
};

const getOnlineUserIds = () => {
  return onlineUsers.map(user => user.userId);
};

io.on("connection", (socket) => {
  // console.log(`🟢 A user connected: ${socket.id}`);

  // Add user to online list
  socket.on("addUser", (userId) => {
    addUser(userId, socket.id);
    socket.emit("connectionStatus", { status: "connected", userId });
    // Send current online users to the newly connected user
    socket.emit("onlineUsers", getOnlineUserIds());
    io.emit("getUsers", onlineUsers);
  });

  // Join order room for messaging
  socket.on("joinOrder", ({ orderId, userId }) => {
    const roomName = `order_${orderId}`;
    socket.join(roomName);
    
    if (!orderRooms.has(orderId)) {
      orderRooms.set(orderId, new Set());
    }
    orderRooms.get(orderId).add(userId);
    
    // console.log(`👥 User ${userId} joined order room ${orderId} (${roomName})`);
    // console.log(`📊 Room ${orderId} now has ${orderRooms.get(orderId).size} users`);
    
    // Notify user they joined the room
    socket.emit("roomJoined", { orderId, userId, roomName });
    
    // Broadcast to room that a new user joined
    socket.to(roomName).emit("userJoined", { userId, orderId });
  });

  // Send and get message
  socket.on("sendMessage", (messageData) => {
    // console.log("📨 Received message:", messageData);
    
    const { senderId, receiverId, content, orderId } = messageData;
    const roomName = `order_${orderId}`;
    
    const message = {
      id: Date.now().toString(), // Temporary ID for real-time
      senderId,
      receiverId,
      content,
      timestamp: new Date(),
      senderName: "User" // Will be populated from database
    };

    // console.log("📤 Broadcasting message to order room:", roomName);

    // Broadcast to all users in the order room (including sender)
    if (orderId) {
      io.in(roomName).emit("newMessage", message);
      // console.log(`✅ Message broadcasted to order room: ${roomName}`);
    }

    // Also send to specific user if they're online and not in the same room
    const user = getUser(receiverId);
    if (user && user.socketId !== socket.id) {
      io.to(user.socketId).emit("getMessage", message);
      // console.log(`✅ Message sent to user: ${receiverId}`);
    }

    // Acknowledge message received
    socket.emit("messageSent", { success: true, messageId: message.id });
  });

  // Handle typing indicators
  socket.on("typing", ({ orderId, userId, isTyping }) => {
    socket.to(`order_${orderId}`).emit("userTyping", { userId, isTyping });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    // console.log(`🔴 A user disconnected: ${socket.id}`);
    removeUser(socket.id);
    io.emit("getUsers", onlineUsers);
  });

  // Error handling
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.log(`Error: ${err.message}`);
  console.log('Shutting down the server due to uncaught exception');
  process.exit(1);
});

module.exports = app; 