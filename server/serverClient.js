// serverClient.js
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');

const app = express();

const REMOTE_PHOTO_BASE = 'https://flameawards.in:8082/photos';

// ---- SECURITY / CSP ----
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    originAgentCluster: false,
    hsts: true,
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

    const request = https.get(remoteUrl, { timeout: 8000 }, (remoteRes) => {
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

const PORT = 8081;
const HOST = '0.0.0.0';

// Load SSL certificates
const sslOptions = {
  cert: fs.readFileSync('/opt/View/sslcertificates/flameawards.crt'),
  ca: fs.readFileSync('/opt/View/sslcertificates/flameawards/ca_bundle.crt'),
  key: fs.readFileSync('/opt/View/sslcertificates/flameawards.key'),
};

https.createServer(sslOptions, app).listen(PORT, HOST, () => {
  console.log(`Frontend server running on https://flameawards.in:${PORT}`);
});
