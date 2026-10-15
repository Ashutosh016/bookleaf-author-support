require('dotenv').config();

// Imports
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const { router } = require('./routes');

// Validate Environment Variables
if (!process.env.JWT_SECRET) {
  console.error(
    'JWT_SECRET is required. Copy server/.env.example to server/.env and configure it.'
  );

  process.exit(1);
}

// Express Application Setup
const app = express();

// Disable Express Technology Header
app.disable('x-powered-by');

// Middleware Configuration

// Allowed Frontend Origins
const defaultOrigins = [
  'http://localhost:5173',
  'https://bookleaf-author-support-mu9pez0k9.vercel.app',
];

const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN
      .split(',')
      .map((origin) => origin.trim().replace(/\/$/, ''))
      .filter(Boolean)
  : defaultOrigins;

// Configure CORS Before API Routes
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests without an Origin header, such as server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '');

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked request from origin: ${origin}`)
      );
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);

// Parse Incoming JSON Requests
app.use(
  express.json({
    limit: '1mb',
  })
);

// Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply Rate Limiting to Login Endpoint
app.use('/api/auth/login', loginLimiter);

// API Routes
app.use('/api', router);

// Server Configuration
const port = process.env.PORT || 4000;

// MongoDB Connection
const mongoURI =
  process.env.MONGODB_URI ||
  'mongodb://127.0.0.1:27017/bookleaf_support';

// MongoDB Connection and Server Startup
mongoose
  .connect(mongoURI)
  .then(() => {
    console.log('Connected to MongoDB successfully.');

    app.listen(port, () => {
      console.log(`BookLeaf API listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Could not connect to MongoDB:', err.message);

    process.exit(1);
  });
