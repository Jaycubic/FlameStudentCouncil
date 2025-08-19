const express = require("express");
const router = express.Router();

const {
  getTotalStudentCount,
  getGenderBatchCount,
  getCityCount,
  getCityWithHighestCount,
  getRCCount,
  getRCFilledCount,
  getInOutCount,
  getInOutBatchCount,
  updateMultipleRC,
  getAllStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getParentsInfo,
  getStudentInfo,
  getHousingDetails,
  getTrackingInfo,
  getBatches,
  getRCNames,
  getStudentPhoto,
} = require("../controllers/StudentController");

// Count routes
router.get("/total-count", getTotalStudentCount);
router.get("/gender-batch-count", getGenderBatchCount);
router.get("/city-count", getCityCount);
router.get("/city-highest-count", getCityWithHighestCount);
router.get("/rc-count", getRCCount);
router.get("/rc-filled-count", getRCFilledCount);
router.get("/inout-count", getInOutCount);
router.get("/inout-batch-count", getInOutBatchCount);

// Specific view routes
router.get("/batches", getBatches);
router.get("/parents-info", getParentsInfo);
router.get("/student-info", getStudentInfo);
router.get("/housing-details", getHousingDetails);
router.get("/tracking-info", getTrackingInfo);
router.get("/rc-names", getRCNames);

// CRUD routes
router.get("/", getAllStudents);
router.get("/:id", getStudentById);
router.post("/", createStudent);
router.patch("/:id", updateStudent);
router.delete("/:id", deleteStudent);

// Update multiple RC Names
router.patch("/update-rc", updateMultipleRC);

// Get student photo
router.get("/photos/:photoId", getStudentPhoto);

module.exports = router;
