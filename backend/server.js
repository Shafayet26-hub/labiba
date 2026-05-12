import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

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
  res.json({ message: 'Aura Backend API is active.', status: 'healthy' });
});

// Signup Endpoint
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Check if user already exists
  db.get(`SELECT id FROM users WHERE email = ?`, [email], async (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    db.run(
      `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
      [name, email, passwordHash],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to register user.' });
        }
        
        // return JWT token
        const token = jwt.sign({ id: this.lastID, name }, SECRET_KEY, { expiresIn: '2h' });
        res.status(201).json({ message: 'User registered successfully', token, user: { name, email } });
      }
    );
  });
});

// Login Endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // return JWT token
    const token = jwt.sign({ id: user.id, name: user.name }, SECRET_KEY, { expiresIn: '2h' });
    res.json({ message: 'Logged in successfully', token, user: { name: user.name, email: user.email } });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
