const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'vivier-api',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Vivier Email AI Assistant API',
    endpoints: {
      health: '/health',
      api: '/api/v1'
    }
  });
});

// Mock API endpoints
app.get('/api/v1/status', (req, res) => {
  res.json({
    database: 'connected',
    ai: 'ready',
    email: 'configured'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});