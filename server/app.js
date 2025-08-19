// server.js (Express backend)
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

// Import cron functions
const { cacheInOutData } = require("./service/cronInOut.js");
const cacheGenderBatchData = require("./service/cronGenderBatch.js");
const startCityRCCron = require("./service/cronCityRC.js");
const startStudentDetailsCron = require("./service/cronStudentDetails.js");

// Import syncAttendance service
const syncAttendance = require("./service/syncAttendance.js");

// Import your Socket setup
const { setupSocket } = require('./socket.js');

const EmployeeRoute = require("./routes/employeeRoutes.js");
const authRoutes = require('./routes/authRoutes.js');
const roleRoutes = require('./routes/roleRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const StudentRoute = require("./routes/studentRoutes.js");
const departmentRoutes = require("./routes/departmentRoutes.js");
const locationRoutes = require("./routes/locationRoutes.js");
const organizationRoutes = require("./routes/organizationRoutes.js");
const pdfRoute = require("./routes/pdfRoutes.js");
const queueRoutes = require("./routes/queueRoutes.js");
const queueDashboardRoutes = require('./routes/queueDashboardRoutes.js');
const legalRoutes = require(`./routes/LegalDocumentRoutes.js`);
const footerRoutes = require(`./routes/footerRoutes.js`);
const reportRoutes = require('./routes/reportRoutes.js');
const simpleAuthRoutes = require('./routes/simpleauth.js');
const queueCountRoutes = require('./routes/queueCountRoutes.js');

const app = express();

app.use(helmet());
app.use(cookieParser());

// Load SSL certificates
const sslOptions = {
  cert: fs.readFileSync('/opt/View/sslcertificates/council_certificate.crt'),
  ca: fs.readFileSync('/opt/View/sslcertificates/council_bundle.crt'),
  key: fs.readFileSync('/opt/View/sslcertificates/council.key'),
};

// Create HTTPS server and bind Socket.IO
const server = https.createServer(sslOptions, app);
const io = setupSocket(server);

const queueDashboardController = require('./controllers/queueDashboardController.js');
queueDashboardController.setIo(io);

// Middleware
app.use(cors({
  origin: 'https://flamestudentcouncil.in:3030', // Allow frontend origin
  credentials: true // Allow credentials (cookies) if needed
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
app.use('/api/simpleauth', simpleAuthRoutes);
app.use("/students", StudentRoute);
app.use("/api/pdf", pdfRoute);
app.use("/api/footer",footerRoutes);
app.use('/api/queue-dashboard', queueDashboardRoutes);
app.use('/api/queue-count', queueCountRoutes);
app.use('/api/photo', require('./routes/photoRoutes.js'));
app.use(EmployeeRoute);
app.use("/keys", require("./routes/keyRoutes.js"));
app.use('/api/counters', require('./routes/counterRoutes.js'));
app.use('/api/student-status', require('./routes/studentStatusRoutes.js'));
app.use('/api/activity-tracker', require('./routes/activityTrackerRoutes.js'));
app.use('/api/formauth', require('./routes/formauthRoutes.js'));
app.use('/api/settings', require('./routes/settingsRoutes.js'));
app.use('/api/wellbeing-form', require('./routes/wellbeingFormRoutes.js'));
app.use('/api/queues', queueRoutes);
app.use('/legal-documents', legalRoutes);
app.use('/api/reports', reportRoutes);
// Serve generated PDFs statically
app.use('/generated_pdfs', express.static('/opt/View/StudentTrackingSystem/server/generated_pdfs'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Default route
app.get("/", (req, res) => {
  res.send("Hello World");
});

// Start unified cron job for cacheInOutData and cacheGenderBatchData
console.log('Starting unified cron job: Caching IN-OUT and gender/batch data every 10 seconds.');
cron.schedule('*/10 * * * * *', async () => {
  cacheInOutData();
  const updatedData = await cacheGenderBatchData();
  if (updatedData) {
    io.emit("updateData", updatedData);
  }
});
cacheInOutData(); // Run immediately on start
cacheGenderBatchData().then((updatedData) => {
  if (updatedData) {
    io.emit("updateData", updatedData);
  }
});

// Start other cron jobs
startCityRCCron(io);
startStudentDetailsCron(io);

// Cleanup old PDFs at midnight every day
const PDF_DIR = '/opt/View/StudentTrackingSystem/server/generated_pdfs';
cron.schedule('0 0 * * *', async () => {
  try {
    const files = await fs.promises.readdir(PDF_DIR);
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cutoffTime = todayMidnight.getTime();
    for (const file of files) {
      const filePath = path.join(PDF_DIR, file);
      const stats = await fs.promises.stat(filePath);
      if (stats.mtime.getTime() < cutoffTime) {
        await fs.promises.unlink(filePath);
        console.log(`Deleted old PDF: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up PDFs:', error);
  }
});

let _server; // will hold our running server

// Function to start server
const startServer = async () => {
  await sequelize.sync();
  const PORT = process.env.PORT || 5050;
  _server = server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Start syncAttendance with Socket.IO
    syncAttendance.setIo(io);
    syncAttendance.startSyncAttendance();
  });
  return _server;
};

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => console.error('Server start error:', err));
}

// Export for testing
module.exports = { app, startServer };
