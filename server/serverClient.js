// frontend-server.js
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');

const app = express();

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

// Serve static files from the frontend 'dist' folder
app.use(express.static(path.join(__dirname, '..', 'Code', 'dist')));
app.use('/generated_pdfs', express.static('/opt/View/StudentTrackingSystem/server/generated_pdfs'));

// Serve index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Code', 'dist', 'index.html'));
});

// SSL certs
const sslOptions = {
  cert: fs.readFileSync('/opt/View/sslcertificates/studenttracking.crt'),
  ca: fs.readFileSync('/opt/View/sslcertificates/ca_bundle.crt'),
  key: fs.readFileSync('/opt/View/sslcertificates/studenttracking.key'),
};

const PORT = process.env.PORT || 6060;
const HOST = process.env.HOST || '0.0.0.0';

https.createServer(sslOptions, app).listen(PORT, HOST, () => {
  console.log(`Frontend server running on https://${HOST}:${PORT}`);
});
