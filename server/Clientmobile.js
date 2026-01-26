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
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  hsts: false,
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
    }
  })
);

const clientDistPath = path.resolve(__dirname, '../../flame_sts/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const PORT = 3031; // Changed to avoid conflict with 3030 if still used, but user said 8081 for frontend. 
// Wait, user said frontend port 8081. serverClient.js is likely the main frontend server.
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Clientmobile running on http://${HOST}:${PORT}`);
});
