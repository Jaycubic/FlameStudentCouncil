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
  origin: 'https://flameawards.in:8081',
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
app.use('/photos', require('./routes/photoRoutes'));
app.use("/api/footer", footerRoutes);
app.use(EmployeeRoute);
app.use('/api/student-status', require('./routes/studentStatusRoutes.js'));
app.use('/api/activity-tracker', require('./routes/activityTrackerRoutes.js'));
app.use('/api/settings', require('./routes/settingsRoutes.js'));
app.use('/legal-documents', legalRoutes);
app.use('/api/form-submissions', formSubmissionRoutes);
app.use('/api/form-processing', formProcessingRoutes);
app.use('/api/time-settings', require('./routes/timeSettingsRoutes.js'));
app.use('/api/sheets', require('./routes/sheetRoutes.js'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
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
    console.log(`Server running on port ${PORT}`);
    formSubmissionController.startQueueWorker();
  });
  return _server;
};

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => console.error('Server start error:', err));
}

// Export for testing
module.exports = { app, startServer };