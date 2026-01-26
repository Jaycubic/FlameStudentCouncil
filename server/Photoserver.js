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

// Serve static files from the 'public' folder
const clientDistPath = path.join(__dirname, 'public');
app.use(express.static(clientDistPath, {
    maxAge: '1y',
    etag: true,
    lastModified: true
}));

const PORT = process.env.PORT || 5052; // Changed to avoid conflict
const HOST = process.env.HOST || '0.0.0.0';

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal Server Error'
    });
});

app.listen(PORT, HOST, () => {
    console.log(`🚀 Photoserver running on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => { process.exit(0); });
process.on('SIGINT', () => { process.exit(0); });
