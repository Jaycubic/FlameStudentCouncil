const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Proxy setup for API requests to backend
app.use(
  '/api',
  createProxyMiddleware({
    target: 'https://flamestudentcouncil.in:5050',
    changeOrigin: true,
    secure: false, // Ignore SSL certificate validation (useful for self-signed certs)
  })
);

// Serve static files from the frontend 'dist' folder
app.use(express.static(path.join(__dirname, '..', 'Code', 'dist')));
app.use('/generated_pdfs', express.static('/opt/View/StudentTrackingSystem/server/generated_pdfs'));

// Handle all other routes by serving index.html (for client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Code', 'dist', 'index.html'));
});

// Load SSL certificates
const sslOptions = {
  cert: fs.readFileSync('/opt/View/sslcertificates/studenttracking.crt'),
  ca: fs.readFileSync('/opt/View/sslcertificates/ca_bundle.crt'),
  key: fs.readFileSync('/opt/View/sslcertificates/studenttracking.key'),
};

const PORT = process.env.PORT || 6060;
const HOST = process.env.HOST || '0.0.0.0';

https.createServer(sslOptions, app).listen(PORT, HOST, () => {
  console.log(`Server running on https://${HOST}:${PORT}`);
});
