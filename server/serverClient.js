// frontend-server.js
const express = require('express');
const http = require('http'); // Switched from https
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');

const app = express();

const REMOTE_PHOTO_BASE = 'http://192.168.8.10:8082/photos'; // Updated to IP and port 8082

// ---- SECURITY / CSP ----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "https://via.placeholder.com"],
        connectSrc: [
          "'self'",
          "http://192.168.8.10:8082", // Updated to IP and port 8082
          "ws://192.168.8.10:8082"    // Updated websocket
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);

// --- Proxy route for student photos ---
app.get('/photos/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    if (!filename || filename.includes('..')) {
      return res.status(400).send('Invalid filename');
    }

    const remoteUrl = `${REMOTE_PHOTO_BASE}/${encodeURIComponent(filename)}`;

    const request = http.get(remoteUrl, { timeout: 8000 }, (remoteRes) => {
      res.statusCode = remoteRes.statusCode || 200;
      const contentType = remoteRes.headers['content-type'];
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      remoteRes.pipe(res);
    });

    request.on('timeout', () => {
      request.destroy();
      res.status(504).send('Photo fetch timeout');
    });

    request.on('error', (err) => {
      console.error('Error fetching remote photo:', err.message);
      res.status(502).send('Failed to fetch photo');
    });
  } catch (err) {
    console.error('Proxy photos handler error:', err);
    res.status(500).send('Server error');
  }
});

// Serve static files from the frontend 'dist' folder
app.use(express.static(path.join(__dirname, '..', 'Code', 'dist')));
app.use('/generated_pdfs', express.static('/opt/View/StudentTrackingSystem/server/generated_pdfs'));

// Serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Code', 'dist', 'index.html'));
});

const PORT = 8081; // Forced to 8081 as requested
const HOST = '0.0.0.0';

http.createServer(app).listen(PORT, HOST, () => {
  console.log(`Frontend server running on http://${HOST}:${PORT}`);
});
