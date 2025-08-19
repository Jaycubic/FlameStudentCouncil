// controllers/formauthController.js

// Directly require the StudentData model, since it isn’t exported via models/index.js
const StudentData = require('../models/StudentData');
const { Queue, Location, Counter } = require('../models');
const jwt = require('jsonwebtoken');
require('dotenv').config();

let io;

exports.setIo = (socketIo) => {
  io = socketIo;
};

exports.authenticateStudent = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required' });
    }

    const student = await StudentData.findOne({ where: { StudentCvueNo: studentId } });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const fatherComplete = student.FatherName && student.FatherEmailID && student.FatherMobileNo;
    const motherComplete = student.MotherName && student.MotherEmailID && student.MotherMobileNo;
    let parentDetails;
    if (fatherComplete) {
      parentDetails = {
        name: student.FatherName,
        email: student.FatherEmailID,
        mobile: student.FatherMobileNo
      };
    } else if (motherComplete) {
      parentDetails = {
        name: student.MotherName,
        email: student.MotherEmailID,
        mobile: student.MotherMobileNo
      };
    } else if (student.FatherName || student.FatherEmailID || student.FatherMobileNo) {
      parentDetails = {
        name: student.FatherName || '',
        email: student.FatherEmailID || '',
        mobile: student.FatherMobileNo || ''
      };
    } else if (student.MotherName || student.MotherEmailID || student.MotherMobileNo) {
      parentDetails = {
        name: student.MotherName || '',
        email: student.MotherEmailID || '',
        mobile: student.MotherMobileNo || ''
      };
    } else {
      parentDetails = {
        name: '',
        email: '',
        mobile: ''
      };
    }

    const tokenPayload = {
      studentId: student.StudentCvueNo,
      studentName: student.StudentName,
      email: student.EmailID,
      parentName: parentDetails.name,
      parentEmail: parentDetails.email,
      parentMobile: parentDetails.mobile
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.status(200).json({ message: 'Authentication successful', token });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
