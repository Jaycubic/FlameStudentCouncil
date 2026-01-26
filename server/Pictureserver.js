const express = require('express');
const http = require('http'); // Switched from https
const fs = require('fs');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "http:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "http:", "https:"],
      imgSrc: ["'self'", "data:", "http:", "https:"],
      connectSrc: ["'self'", "http:", "https:"],
      fontSrc: ["'self'", "http:", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
}));

// CORS configuration for all domains
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Proxy setup for API requests to backend
app.use(
  '/api',
  createProxyMiddleware({
    target: process.env.API_TARGET || 'http://192.168.8.10:8082', // Updated
    changeOrigin: true,
    secure: false,
    timeout: 30000,
    proxyTimeout: 30000,
    onError: (err, req, res) => {
      console.error('Proxy Error:', err.message);
      res.status(502).json({ error: 'Bad Gateway - Unable to connect to backend service' });
    },
    onProxyReq: (proxyReq, req) => {
      console.log(`[${new Date().toISOString()}] Proxying ${req.method} ${req.url} to ${proxyReq.path}`);
    }
  })
);

// --------------------------------------------------------------------
// Frontend dist folder is at /opt/View/flame_sts/dist
const clientDistPath = path.resolve(__dirname, '../../flame_profile_capture/dist');

// Serve static files from the frontend 'dist' folder
app.use(express.static(clientDistPath, {
  maxAge: '1y',
  etag: true,
  lastModified: true
}));

// Serve generated PDFs if the directory exists
const pdfPath = process.env.PDF_PATH || path.join(__dirname, 'generated_pdfs');
if (fs.existsSync(pdfPath)) {
  app.use('/generated_pdfs', express.static(pdfPath, {
    maxAge: '1d',
    etag: true
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Handle all other routes by serving index.html
app.get('*', (req, res) => {
  const indexPath = path.join(clientDistPath, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return res.status(500).json({
      error: 'Application not built',
      message: 'Please run "npm run build" to create the production build'
    });
  }

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
});

// Server configuration & error handling
const PORT = process.env.PORT || 5051; // Changed to avoid conflict if needed, default was 5050
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'production';

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 FLAME STS Pictureserver running on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => { console.log('🔄 SIGTERM, shutting down…'); process.exit(0); });
process.on('SIGINT', () => { console.log('🔄 SIGINT, shutting down…'); process.exit(0); });
process.on('uncaughtException', err => { console.error('❌ Uncaught Exception:', err); process.exit(1); });
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
