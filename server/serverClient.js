// serverClient.js
const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');

const app = express();

const REMOTE_PHOTO_BASE = 'https://flamestudentcouncil.in/api/photos';

// ---- SECURITY / CSP ----
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://static.cloudflareinsights.com", // ← Cloudflare Web Analytics
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com", // ← Google Fonts stylesheet
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://cdn-icons-png.flaticon.com",
          "https://flamestudentcouncil.in",
          "https://via.placeholder.com",
        ],
        connectSrc: [
          "'self'",
          "https://flamestudentcouncil.in",
          "https://cloudflareinsights.com", // ← Cloudflare sends beacon data here
        ],
        fontSrc: [
          "'self'",
          "data:",
          "https://fonts.gstatic.com", // ← Google Fonts actual font files
        ],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-site" },
    originAgentCluster: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
    xFrameOptions: { action: "deny" },
  })
);

// ---- Rate limiting for photo proxy ----
// npm install express-rate-limit
const rateLimit = require('express-rate-limit');
const photoLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 photo requests per minute per IP — generous enough for normal use
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please slow down.',
});

// Allowed image MIME types from the proxy
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// --- Proxy route for student photos ---
app.get('/photos/:filename', photoLimiter, (req, res) => {
  try {
    const filename = req.params.filename;

    // Strict filename validation — alphanumeric, dashes, dots, and common image extensions only
    if (!filename || !/^[\w\-.]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
      return res.status(400).send('Invalid filename');
    }

    const remoteUrl = `${REMOTE_PHOTO_BASE}/${encodeURIComponent(filename)}`;

    const request = https.get(remoteUrl, { timeout: 8000 }, (remoteRes) => {
      // Validate the content type returned by upstream
      const rawContentType = remoteRes.headers['content-type'] || '';
      const mimeType = rawContentType.split(';')[0].trim().toLowerCase();

      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        remoteRes.resume(); // drain the response so the socket closes cleanly
        return res.status(400).send('Upstream returned non-image content');
      }

      res.statusCode = remoteRes.statusCode || 200;
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      // Prevent the proxied image from being used in <script> or embedded frames
      res.setHeader('X-Content-Type-Options', 'nosniff');
      remoteRes.pipe(res);
    });

    request.on('timeout', () => {
      request.destroy();
      if (!res.headersSent) res.status(504).send('Photo fetch timeout');
    });

    request.on('error', (err) => {
      console.error('Error fetching remote photo:', err.message);
      if (!res.headersSent) res.status(502).send('Failed to fetch photo');
    });
  } catch (err) {
    console.error('Proxy photos handler error:', err);
    if (!res.headersSent) res.status(500).send('Server error');
  }
});

// Serve static files from the frontend 'dist' folder
app.use(express.static(path.join(__dirname, '..', 'Code', 'dist'), {
  // Don't expose directory listings
  index: false,
  // Set strict content type on static files
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
    if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css');
  }
}));

app.use('/generated_pdfs', express.static('/opt/View/StudentTrackingSystem/server/generated_pdfs', {
  index: false, // no directory listing
}));

// ── Merged attachment PDFs — served inline (no auth needed) ──────────────────
// Serves /attachments/{sport|cultural|academic}/{filename} directly from disk.
// sport/, cultural/, academic/ already exist; no merged/ subfolder needed.
// MUST be before the SPA catch-all (*) so Express handles it, not React Router.
app.use('/attachments', express.static('/opt/View/FlameStudentCouncil/server/Attachments', {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');   // preview in browser tab
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

// Serve index.html for SPA routes — but only for non-file paths
app.get('*', (req, res) => {
  // Don't serve index.html for obvious asset requests that weren't found
  if (/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|map|pdf)$/.test(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, '..', 'Code', 'dist', 'index.html'));
});

const PORT = 8081;
const HOST = '0.0.0.0';

// Load SSL certificates
const sslOptions = {
  cert: fs.readFileSync('/opt/View/sslcertificates/council_certificate.crt'),
  ca: fs.readFileSync('/opt/View/sslcertificates/council_bundle.crt'),
  key: fs.readFileSync('/opt/View/sslcertificates/council.key'),
};

https.createServer(sslOptions, app).listen(PORT, HOST, () => {
  console.log(`Frontend server running on https://flamestudentcouncil.in:${PORT}`);
});