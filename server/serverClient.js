// frontend-server.js
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');

const app = express();

const REMOTE_PHOTO_BASE = 'https://flamestudentcouncil.in:5050/photos';

// ---- SECURITY / CSP ----
// This CSP allows:
//  - scripts/styles/fonts from self + Google fonts/apis
//  - images from self, data:, https:, and specific common hosts like via.placeholder.com
//  - connect to backend direct origin (if client fetches backend directly)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        // Allow images from self, data, any https host, and explicitly via.placeholder.com
        imgSrc: ["'self'", "data:", "https:", "https://via.placeholder.com"],
        // Allow fetch/websocket direct to backend origin
        connectSrc: [
          "'self'",
          "https://flamestudentcouncil.in:5050",
          "wss://studenttracking.in:5173"
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
  })
);

// --- Proxy route for student photos ---
// Purpose: serve photos from remote backend through this frontend origin so browser won't block them.
// Example usage in front-end: photoUrl = `/photos/${currentUser.photo}.jpg`
app.get('/photos/:filename', (req, res) => {
  try {
    // sanitize filename and build remote URL (preserve any additional path/extension)
    const filename = req.params.filename;
    if (!filename || filename.includes('..')) {
      return res.status(400).send('Invalid filename');
    }

    const remoteUrl = `${REMOTE_PHOTO_BASE}/${encodeURIComponent(filename)}`;

    // Set a timeout for the remote request
    const request = https.get(remoteUrl, { timeout: 8000 }, (remoteRes) => {
      // Forward remote status code
      res.statusCode = remoteRes.statusCode || 200;

      // Forward content-type and other useful headers
      const contentType = remoteRes.headers['content-type'];
      if (contentType) res.setHeader('Content-Type', contentType);

      // Set caching headers (tunable)
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // Pipe the remote response body to the client
      remoteRes.pipe(res);
    });

    request.on('timeout', () => {
      request.destroy();
      res.status(504).send('Photo fetch timeout');
    });

    request.on('error', (err) => {
      console.error('Error fetching remote photo:', err.message);
      // If remote returned 404 it may surface as an error — respond with 404
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

// SSL certs
const sslOptions = {
  cert: fs.readFileSync('/opt/View/sslcertificates/council_certificate.crt'),
  ca: fs.readFileSync('/opt/View/sslcertificates/council_bundle.crt'),
  key: fs.readFileSync('/opt/View/sslcertificates/council.key'),
};

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || '0.0.0.0';

https.createServer(sslOptions, app).listen(PORT, HOST, () => {
  console.log(`Frontend server running on https://${HOST}:${PORT}`);
});
