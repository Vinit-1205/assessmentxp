require('dotenv').config();

// Validate required environment variables at startup
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error(`[FATAL] Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
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

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS for frontend requests
app.use(cors({
  origin: '*', // Adjust in production to frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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

// Base / Health-check Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralised Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Global Error Handler]:', err.stack || err);
  const isProduction = process.env.NODE_ENV === 'production';
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
