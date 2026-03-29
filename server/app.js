// app.js (Express backend)
const express = require('express');
const cors = require('cors');
const bodyParser = require("body-parser");
const cron = require("node-cron");
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const log = require('./utils/logger').child({ module: 'App' });

// Import database connection
const sequelize = require("./config/database.js");
const postgresSequelize = require("./config/connection.js");


// Import your Socket setup
const { setupSocket } = require('./socket.js');

const EmployeeRoute = require("./routes/employeeRoutes.js");
const authRoutes = require('./routes/authRoutes.js');
const roleRoutes = require('./routes/roleRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const departmentRoutes = require("./routes/departmentRoutes.js");
const locationRoutes = require("./routes/locationRoutes.js");
const organizationRoutes = require("./routes/organizationRoutes.js");
const legalRoutes = require(`./routes/LegalDocumentRoutes.js`);
const footerRoutes = require(`./routes/footerRoutes.js`);
const formSubmissionRoutes = require('./routes/formSubmissionRoutes.js');
const formProcessingRoutes = require('./routes/formProcessingRoutes.js');
const formSubmissionController = require('./controllers/formSubmissionController.js');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  hsts: false,
}));
app.use(cookieParser());

// Load SSL certificates
const sslOptions = {
  cert: fs.readFileSync('/opt/View/sslcertificates/flameawards.crt'),
  ca: fs.readFileSync('/opt/View/sslcertificates/flameawards/ca_bundle.crt'),
  key: fs.readFileSync('/opt/View/sslcertificates/flameawards.key'),
};

// Create HTTPS server and bind Socket.IO
const server = https.createServer(sslOptions, app);
const io = setupSocket(server);


// Middleware
app.use(cors({
  origin: 'https://flameawards.in',
  credentials: true
}));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/photos', require('./routes/photoRoutes'));
app.use("/api/footer", footerRoutes);
app.use('/api', EmployeeRoute);
app.use('/api/student-status', require('./routes/studentStatusRoutes.js'));
app.use('/api/activity-tracker', require('./routes/activityTrackerRoutes.js'));
app.use('/api/settings', require('./routes/settingsRoutes.js'));
app.use('/legal-documents', legalRoutes);
app.use('/api/form-submissions', formSubmissionRoutes);
app.use('/api/form-processing', formProcessingRoutes);
app.use('/api/time-settings', require('./routes/timeSettingsRoutes.js'));
app.use('/api/sheets', require('./routes/sheetRoutes.js'));
app.use('/api/dashboard', require('./routes/dashboardRoutes.js'));
app.use('/api/applicants', require('./routes/applicantsRoutes.js'));



// Start BullMQ sheet worker (runs in-process)
require('./workers/sheetWorker');

// Start BullMQ photo-upload worker (concurrency=3, hybrid master/student fallback)
require('./workers/photoUploadWorker');

// Error handling middleware
app.use((err, req, res, next) => {
  log.error({ err: err.message, stack: err.stack }, 'Unhandled Route Error');
  res.status(500).json({ message: 'Something went wrong!' });
});

// Default route
app.get("/", (req, res) => {
  res.send("Hello World");
});


let _server;

// Function to start server
const startServer = async () => {
  await sequelize.sync();
  await postgresSequelize.sync();
  const PORT = 8082; // Forced to 8082 as requested
  _server = server.listen(PORT, '0.0.0.0', () => {
    log.info({ port: PORT }, 'Server running');
    formSubmissionController.startQueueWorker();
  });
  return _server;
};

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => log.error({ err }, 'Server start error'));
}

// Export for testing
module.exports = { app, startServer };