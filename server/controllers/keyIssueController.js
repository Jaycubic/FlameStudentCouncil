const RoomKey = require("../models/RoomKey");
const StudentData = require("../models/StudentData");
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendKeyIssuedEmail = async (studentEmail, studentName, studentId, rcName, housingBlock, issuedDate) => {
  try {
    await transporter.sendMail({
      from: `"FLAME STS" <${process.env.EMAIL_USER}>`,
      to: studentEmail,
      cc: 'admicsctsce@flame.edu.in',
      subject: 'Room Key Issued',
      html: `
        <h2>Room Key Issued</h2>
        <p>Dear ${studentName},</p>
        <p>Your room key has been issued with the following details:</p>
        <ul>
          <li>Student ID: ${studentId}</li>
          <li>RC Name: ${rcName}</li>
          <li>Housing Block: ${housingBlock}</li>
          <li>Date Issued: ${issuedDate}</li>
        </ul>
        <p>Please keep this key safe and return it when required.</p>
      `,
    });
    return true;
  } catch (error) {
    console.error('❌ Email sending error:', error);
    return false;
  }
};

const issueKey = async (req, res) => {
  const { studentId } = req.body;
  try {
    const student = await StudentData.findOne({ where: { StudentCvueNo: studentId } });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const existingKey = await RoomKey.findOne({
      where: { StudentId: studentId, Returned: null },
    });
    if (existingKey) {
      return res.status(400).json({ message: 'Key already issued and not returned' });
    }

    const issuedDate = new Date();
    const newKey = await RoomKey.create({
      StudentId: studentId,
      StudentName: student.StudentName,
      RCName: student.RCName,
      HousingBlock: student.HousingBlock,
      Issued: issuedDate,
    });

    const emailSent = await sendKeyIssuedEmail(
      student.EmailID,
      student.StudentName,
      studentId,
      student.RCName,
      student.HousingBlock,
      issuedDate.toDateString()
    );

    if (!emailSent) {
      return res.status(500).json({ message: 'Failed to send email' });
    }

    res.status(201).json({ message: 'Key issued successfully', key: newKey });
  } catch (error) {
    console.error('Error in issueKey:', error);
    res.status(500).json({ message: 'Failed to issue key', error: error.message });
  }
};

const returnKey = async (req, res) => {
  const { studentId } = req.body;
  try {
    const keyRecord = await RoomKey.findOne({
      where: { StudentId: studentId, Returned: null },
    });
    if (!keyRecord) {
      return res.status(404).json({ message: 'No issued key found for this student' });
    }

    const returnedDate = new Date();
    await keyRecord.update({ Returned: returnedDate });

    res.json({ message: 'Key returned successfully', key: keyRecord });
  } catch (error) {
    console.error('Error in returnKey:', error);
    res.status(500).json({ message: 'Failed to return key', error: error.message });
  }
};

const getKeyStatus = async (req, res) => {
  const { studentId } = req.params;
  try {
    const keyRecord = await RoomKey.findOne({
      where: { StudentId: studentId, Returned: null },
    });
    if (keyRecord) {
      res.json({ status: 'issued', issuedDate: keyRecord.Issued });
    } else {
      res.json({ status: 'not_issued' });
    }
  } catch (error) {
    console.error('Error in getKeyStatus:', error);
    res.status(500).json({ message: 'Failed to fetch key status', error: error.message });
  }
};

module.exports = {
  issueKey,
  returnKey,
  getKeyStatus,
};
