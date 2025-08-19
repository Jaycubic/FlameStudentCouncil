const { Sequelize, QueryTypes, Op } = require("sequelize");
const essl = require("../config/essl");
const PunchLog = require("../models/PunchLog");
const EmployeeStudentMaster = require("../models/EmployeeStudentMaster");
const Queue = require("../models/Queue");
const Location = require("../models/Location");

// Keep track of the last processed ID and processed IDs
let lastId = 0;
const processedIds = new Set();

// Map from device ID to location name
let deviceIdToLocationMap = {};

// Initialize Socket.IO
let io;
let isPolling = false;
const setIo = (socketIo) => {
  io = socketIo;
  console.log("Socket.IO set in syncAttendance");
};

// Fetch employee by code with optimized attributes
async function getEmployeeByCode(code) {
  if (!code) throw new Error("Code parameter is required");

  const employee = await EmployeeStudentMaster.findOne({
    where: { EmployeeCode: code },
    attributes: ["EmployeeName", "Batch", "Gender", "DOB", "Email"],
  });

  if (!employee) throw new Error("Employee not found");
  return employee;
}

// Create queue entry
async function createQueue({ EmployeeId, EmployeeName, Gender, Department, Email, locationName, DeviceId, status = "WAIT" }) {
  if (!EmployeeId || !EmployeeName || !Department || !locationName || !DeviceId) {
    throw new Error("All required fields must be provided");
  }

  // Check if the queue entry already exists
  const existingQueue = await Queue.findOne({
    where: {
      EmployeeId,
      locationName,
    },
  });

  if (existingQueue) {
    console.log(`Queue entry already exists for EmployeeId: ${EmployeeId} at location: ${locationName}`);
    return existingQueue; // Return the existing entry instead of creating a new one
  }

  const newQueue = await Queue.create({
    EmployeeId,
    EmployeeName,
    Gender,
    Department,
    Email,
    locationName,
    DeviceId,
    status,
  });

  if (io) io.emit("queueUpdate", newQueue);
  return newQueue;
}

// Initialize device map
async function initDeviceMap() {
  const locations = await Location.findAll({ attributes: ['DeviceId', 'locationName'] });
  deviceIdToLocationMap = {};
  locations.forEach(loc => {
    deviceIdToLocationMap[loc.DeviceId] = loc.locationName;
  });
  console.log('Device map initialized:', deviceIdToLocationMap);
}

// Polling function with SQL Server–style time filter
async function pollAttendance() {
  if (isPolling) {
    console.log("Poll already in progress, skipping.");
    return;
  }
  isPolling = true;

  try {
    const deviceIds = Object.keys(deviceIdToLocationMap).map(id => parseInt(id, 10));
    if (deviceIds.length === 0) {
      console.log('No devices to poll.');
      return setTimeout(pollAttendance, 100);
    }

    // Only pull logs newer than lastId AND LogDate within last 1 minute by SQL Server time
    const logs = await essl.query(
      `SELECT DeviceLogId, UserId, LogDate, DeviceId
       FROM DeviceLogs1
       WHERE DeviceLogId > :lastId
         AND DeviceId IN (:deviceIds)
         AND LogDate >= DATEADD(minute, -1, GETDATE())
       ORDER BY DeviceLogId ASC;`,
      {
        replacements: { lastId, deviceIds },
        type: QueryTypes.SELECT,
      }
    );

    if (logs.length === 0) {
      return; // nothing fresh to process
    }

    const results = await Promise.all(logs.map(async log => {
      const { UserId, LogDate, DeviceLogId, DeviceId } = log;

      if (processedIds.has(DeviceLogId)) {
        console.log(`Skipping duplicate DeviceLogId: ${DeviceLogId}`);
        return null;
      }

      const locationName = deviceIdToLocationMap[DeviceId];
      if (!locationName) {
        console.error(`Location not found for DeviceId: ${DeviceId}`);
        return null;
      }

      // Create the new punch record
      const newPunch = await PunchLog.create({
        EmployeeCode: UserId,
        PunchTime: LogDate,
        DeviceId,
      });

      // Enqueue if employee exists
      let employee = null;
      try {
        employee = await getEmployeeByCode(UserId);
      } catch (err) {
        console.error(err.message);
      }
      if (employee) {
        const newQueue = await createQueue({
          EmployeeId: UserId,
          EmployeeName: employee.EmployeeName,
          Gender: employee.Gender,
          Department: employee.Batch,
          Email: employee.Email,
          locationName,
          DeviceId,
          status: "WAIT",
        });
        if (io) io.emit("queueUpdate", newQueue);
      }

      // Notify clients of the new punch
      if (io) {
        io.emit("punchUpdate", {
          EmployeeCode: UserId,
          PunchTime: LogDate,
          id: newPunch.id,
          DeviceId,
          EmployeeName: employee ? employee.EmployeeName : null,
        });
      }

      processedIds.add(DeviceLogId);
      return DeviceLogId;
    }));

    const successfulIds = results.filter(id => id);
    if (successfulIds.length) {
      lastId = Math.max(...successfulIds);
    }

  } catch (error) {
    console.error("Error polling attendance:", error);
  } finally {
    isPolling = false;
    setTimeout(pollAttendance, 100);
  }
}

// Start polling after initializing device map
function startSyncAttendance() {
  initDeviceMap()
    .then(() => pollAttendance())
    .catch(error => console.error('Error starting sync attendance:', error));
}

// Manually trigger sync
function triggerSync() {
  pollAttendance();
}

module.exports = { startSyncAttendance, setIo, triggerSync };
