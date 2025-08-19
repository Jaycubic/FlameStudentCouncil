const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeStudentMasterController");

// Get a single employee by RFID number
// Example: GET /employee?rfid=123456789
router.get("/employee", employeeController.getEmployeeByCode);

// Get a paginated list of employees
// Example: GET /employees?page=1&limit=50
router.get("/employees", employeeController.getEmployees);

module.exports = router;
