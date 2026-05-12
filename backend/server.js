import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
// import db from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'aura_super_secret_key_123_dev';

console.log(`Starting server on port ${PORT}...`);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
].filter(Boolean);

console.log(`Allowed Origins: ${allowedOrigins.join(', ')}`);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());

// Root Route / Health Check
app.get('/', (req, res) => {
  res.json({ message: 'Aura Backend API is active (Testing mode).', status: 'healthy' });
});

/*
// Signup Endpoint
app.post('/api/signup', async (req, res) => {
  // ... (omitted for test)
});

// Login Endpoint
app.post('/api/login', (req, res) => {
  // ... (omitted for test)
});
*/

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
