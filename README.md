# Freelance App – Backend

This is the **backend server** for the Freelance Marketplace application. Built with **Node.js**, **Express**, and **Mongoose (MongoDB)**, it provides secure RESTful APIs for user authentication, gig management, orders, messaging, reviews, and more.

---

## Features

- JWT-based user authentication (clients & freelancers)
- Role-based access controls
- Gig CRUD operations
- Order processing and status tracking
- Stripe payment integration
- Image upload via Cloudinary
- Real-time bidding and messaging (Socket.io)
- Admin dashboard for content moderation

---

## Tech Stack

- **Backend**: Node.js, Express.js  
- **Database**: MongoDB (Mongoose)  
- **Authentication**: JWT & bcrypt  
- **File Uploads**: Multer + Cloudinary  
- **Payments**: Stripe  
- **Real-time**: Socket.io  
- **Security**: Helmet, rate limiting, CORS, dotenv

---

## Project Structure

```
server/
├── controllers/      # Business logic for routes
├── models/           # Database schemas
├── routes/           # API endpoints
├── middleware/       # Auth, error handling, etc.
├── config/           # DB & service configuration
├── utils/            # Helper functions
├── uploads/          # Local uploads (if used)
├── server.js         # Main application entry point
├── package.json
└── .env.example      # Sample environment variables
```

---

## Setup Instructions

### 1. Clone & Install
```bash
git clone https://github.com/Satya-0023/Freelance-app--backend.git
cd Freelance-app--backend
npm install
```

### 2. Environment Variables  
Create `.env` based on `.env.example` with your own values:
```
PORT=5000
MONGODB_URI=your_mongo_connection
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
STRIPE_SECRET_KEY=...
```

### 3. Run the server
```bash
npm run dev
```
Access API at: `http://localhost:5000`

---

## Available API Endpoints

- `POST /api/auth/register` — Register user  
- `POST /api/auth/login` — User login  
- `GET /api/gigs` — List gigs  
- `POST /api/gigs` — Create new gig (Protected)  
- `POST /api/orders` — Place an order (Protected)  
- `POST /api/messages` — Post a chat message  
*…add others based on your routes…*

---

## License

Licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
