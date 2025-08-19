// controllers/simpleAuthController.js

// Directly require the StudentData model
const StudentData = require('../models/StudentData');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.verifyStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    const student = await StudentData.findOne({
      where: { StudentCvueNo: studentId }
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Build a minimal payload
    const tokenPayload = {
      studentId: student.StudentCvueNo,
      studentName: student.StudentName,
      email: student.EmailID
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });

    return res
      .status(200)
      .json({ message: 'Verification successful', token });
  } catch (error) {
    console.error('Verification error:', error);
    return res
      .status(500)
      .json({ message: 'Internal server error' });
  }
};
