import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.send('<h1>Welcome to Freelance Marketplace API 🎯</h1>');
});

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Backend is running ✅'
  });
});

export default router;
