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

// CORS configuration
app.use(cors({
 origin: [
   'https://freelance-app-frontend-hdm6.vercel.app', // Vercel deployed frontend
],
  credentials: true
}));

app.set('trust proxy', 1); // Trust first proxy (Render uses reverse proxies)


// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Stripe webhook raw body
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), require('./controllers/paymentController').stripeWebhook);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware (optional)
// if (process.env.NODE_ENV === 'development') {
//   app.use(morgan('dev'));
// }

// ✅ Root route for health check (Render will show this)
app.get('/', (req, res) => {
  res.send('<h2>🎉 Freelance Marketplace Backend is Live!</h2><p>Status: ✅ Running</p>');
});

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
app.use('/api/services', require('./routes/gigs')); // Alias
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));

// 404 handler
app.use(notFound);

// Error handler
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
let orderRooms = new Map();

const addUser = (userId, socketId) => {
  const existingUser = onlineUsers.find(user => user.userId === userId);
  if (existingUser) {
    existingUser.socketId = socketId;
  } else {
    onlineUsers.push({ userId, socketId });
    io.emit('userOnline', userId);
  }
};

const removeUser = (socketId) => {
  const user = onlineUsers.find(user => user.socketId === socketId);
  if (user) {
    io.emit('userOffline', user.userId);
    onlineUsers = onlineUsers.filter(user => user.socketId !== socketId);
  }
};

const getUser = (userId) => {
  return onlineUsers.find(user => user.userId === userId);
};

const getOnlineUserIds = () => {
  return onlineUsers.map(user => user.userId);
};

io.on("connection", (socket) => {
  socket.on("addUser", (userId) => {
    addUser(userId, socket.id);
    socket.emit("connectionStatus", { status: "connected", userId });
    socket.emit("onlineUsers", getOnlineUserIds());
    io.emit("getUsers", onlineUsers);
  });

  socket.on("joinOrder", ({ orderId, userId }) => {
    const roomName = `order_${orderId}`;
    socket.join(roomName);

    if (!orderRooms.has(orderId)) {
      orderRooms.set(orderId, new Set());
    }
    orderRooms.get(orderId).add(userId);

    socket.emit("roomJoined", { orderId, userId, roomName });
    socket.to(roomName).emit("userJoined", { userId, orderId });
  });

  socket.on("sendMessage", (messageData) => {
    const { senderId, receiverId, content, orderId } = messageData;
    const roomName = `order_${orderId}`;

    const message = {
      id: Date.now().toString(),
      senderId,
      receiverId,
      content,
      timestamp: new Date(),
      senderName: "User"
    };

    if (orderId) {
      io.in(roomName).emit("newMessage", message);
    }

    const user = getUser(receiverId);
    if (user && user.socketId !== socket.id) {
      io.to(user.socketId).emit("getMessage", message);
    }

    socket.emit("messageSent", { success: true, messageId: message.id });
  });

  socket.on("typing", ({ orderId, userId, isTyping }) => {
    socket.to(`order_${orderId}`).emit("userTyping", { userId, isTyping });
  });

  socket.on("disconnect", () => {
    removeUser(socket.id);
    io.emit("getUsers", onlineUsers);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Graceful shutdown
process.on('unhandledRejection', (err, promise) => {
  console.log(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  console.log(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

module.exports = app;
