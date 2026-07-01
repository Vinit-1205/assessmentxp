const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Validate database configuration
if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  console.warn("WARNING: DATABASE_URL or PGHOST environment variable is not set. Database connections will fail.");
}

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exam');
const resultRoutes = require('./routes/result');
const usersRoutes = require('./routes/users');
const violationRoutes = require('./routes/violations');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const dbQueryRoutes = require('./routes/dbQuery');

const app = express();
const PORT = process.env.PORT || 8080;
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;

// Enable static file serving for local uploads (certificates/snapshots)
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Enable CORS for frontend requests (only in non-production environments)
if (!isProduction) {
  app.use(cors({
    origin: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
}

// Parse raw JSON payloads — 10mb limit to accommodate base64 webcam snapshots
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Register API Routes
app.use('/api', authRoutes);
app.use('/api', examRoutes);
app.use('/api', resultRoutes);
app.use('/api', usersRoutes);
app.use('/api', violationRoutes);
app.use('/api', publicRoutes);
app.use('/api', adminRoutes);
app.use('/api', dbQueryRoutes);

// Base / Health-check Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets from the frontend build
app.use(express.static(path.join(__dirname, '../../dist')));

// Serve SPA frontend index.html for any other non-API/non-health requests
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Centralised Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err.stack || err);
  const status = err.status || 500;
  res.status(status).json({
    error: (status === 500 && isProduction) 
      ? 'An unexpected error occurred. Please try again later.' 
      : (err.message || 'Internal Server Error')
  });
});

app.listen(PORT, () => {
  console.log(`[Express Backend] Listening on port ${PORT}`);
});
