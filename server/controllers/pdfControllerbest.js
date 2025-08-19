const { PDFDocument, StandardFonts, PDFName, PDFNumber } = require('pdf-lib');
const path = require('path');
const fs = require('fs');
const { getStudentsByIdsForPDF } = require('../service/studentService');
const { User } = require('../models');
const nodemailer = require('nodemailer');


// Nodemailer transporter setup (copied from authController)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Function to send email report
const sendGenerationReportEmail = async (userId, numberOfIds) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      console.error('User not found for ID:', userId);
      return;
    }
    const generationTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const emailContent = `
      <h2>ID Card Generation Report</h2>
      <p><strong>User:</strong> ${user.username} (${user.email})</p>
      <p><strong>Number of IDs generated:</strong> ${numberOfIds}</p>
      <p><strong>Date and Time:</strong> ${generationTime}</p>
    `;
    await transporter.sendMail({
      from: `"FLAME STS" <${process.env.EMAIL_USER}>`,
      to: 'jofrey.joseph@flame.edu.in',
      cc: 'jofreyjohnmrutu01@gmail.com',
      subject: 'ID Card Generation Report',
      html: emailContent,
    });
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

const getPhotoPath = (photoId) => {
  const photoDir = '/opt/View/StudentTrackingSystem/server/Photos';
  const extensions = ['.jpg', '.jpeg', '.png'];
  for (const ext of extensions) {
    const filePath = path.join(photoDir, `${photoId}${ext}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  console.warn(`Photo not found for ID ${photoId} in ${photoDir}`);
  return null;
};

const triggerPDFGeneration = async (req, res) => {
  try {
    const { studentIds } = req.body;
    console.log('Received studentIds (StudentCvueNo):', studentIds);

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Student IDs are required and must be an array' });
    }

    const parsedStudentCvueNos = studentIds
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id));
    if (parsedStudentCvueNos.length === 0) {
      return res.status(400).json({ message: 'All student IDs must be valid numbers' });
    }

    const students = await getStudentsByIdsForPDF(parsedStudentCvueNos);
    console.log('Students fetched:', students);
    if (students.length === 0) {
      return res.status(404).json({ message: 'No students found for the provided StudentCvueNo values' });
    }

    const studentsForPDF = students.map(student => {
      const photoPath = getPhotoPath(student.Photo);
      let photoBase64 = null;
      if (photoPath) {
        try {
          photoBase64 = fs.readFileSync(photoPath).toString('base64');
          console.log(`Photo encoded for ${student.StudentName}: ${photoPath}`);
        } catch (err) {
          console.error(`Failed to encode photo ${photoPath}:`, err);
        }
      }
      return {
        StudentName: student.StudentName || 'N/A',
        StudentCvueNo: student.StudentCvueNo != null ? student.StudentCvueNo.toString() : 'N/A',
        DOB: student.DOB ? new Date(student.DOB).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric'
        }) : 'N/A',
        Validity: student.Validity || 'N/A',
        Blood: student.BloodGroup || 'N/A',
        Batch: student.Batch || 'N/A',
        Photo: photoBase64
      };
    });

    // Define paths for template and output
    const templatePath = '/opt/View/StudentTrackingSystem/server/controllers/IDtemplate.pdf';
    const outputDir = '/opt/View/StudentTrackingSystem/server/generated_pdfs';
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `student_ids_${timestamp}.pdf`);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const finalPdfDoc = await PDFDocument.create();
    const templateBytes = fs.readFileSync(templatePath);
    const studentsPerPage = 5;
    const totalPages = Math.ceil(studentsForPDF.length / studentsPerPage);

    const fieldNames = {
      Name: 'StudentName',
      StudentID: 'StudentCvueNo',
      DOB: 'DOB',
      Validity: 'Validity',
      Blood: 'Blood',
      Batch: 'Batch',
      Photo: 'Photo'
    };

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      const pdfDoc = await PDFDocument.load(templateBytes);
      const form = pdfDoc.getForm();
      // Embed Helvetica-Bold for all text fields
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const page = pdfDoc.getPages()[0];
      const start = pageNum * studentsPerPage;
      const end = Math.min(start + studentsPerPage, studentsForPDF.length);
      const pageStudents = studentsForPDF.slice(start, end);

      for (let i = 0; i < pageStudents.length; i++) {
        const student = pageStudents[i];
        const slot = i; // 0 to 4

        // Fill text fields
        for (const [label, key] of Object.entries(fieldNames)) {
          if (label === 'Photo') continue;

          let fieldName = slot === 0 ? label : `${label} ${slot + 1}`;
          try {
            const field = form.getTextField(fieldName);
            let value = student[key];

            // Special logic for Batch: allow up to 3 chars only when starting with "PH"
            if (label === 'Batch' && typeof value === 'string' && value.startsWith('PH')) {
              if (value.length > 3) {
                value = value.slice(0, 3);
              }
              // Also bump the field's MaxLen to 3
              const acroField = field.acroField;
              acroField.dict.set(
                PDFName.of('MaxLen'),
                PDFNumber.of(3)
              );
            }

            console.log(`Setting ${fieldName} to "${value}"`);
            field.setText(String(value));

            // **Adjusted font-size**: larger for Name & StudentID, keep 8 for others
            const fontSize = (label === 'Name' || label === 'StudentID') ? 10 : 8;
            field.setFontSize(fontSize);

            // Bold appearance
            field.updateAppearances(boldFont);
          } catch (err) {
            console.warn(`Field ${fieldName} not found or error setting text:`, err);
          }
        }

        // Place photo if available
        if (student.Photo) {
          let photoFieldName = slot === 0 ? 'Photo' : `Photo ${slot + 1}`;
          try {
            const photoField = form.getTextField(photoFieldName);
            const widgets = photoField.acroField.getWidgets();
            if (widgets.length) {
              const widget = widgets[0];
              const rect = widget.getRectangle();
              const imageBytes = Buffer.from(student.Photo, 'base64');
              const image = await pdfDoc.embedJpg(imageBytes);
              const scale = Math.min(rect.width / image.width, rect.height / image.height);
              const w = image.width * scale;
              const h = image.height * scale;
              const x = rect.x + (rect.width - w) / 2;
              const y = rect.y + (rect.height - h) / 2;
              page.drawImage(image, { x, y, width: w, height: h });
            }
          } catch (err) {
            console.warn(`Error placing photo for ${photoFieldName}:`, err);
          }
        }
      }

      form.flatten();
      const [copiedPage] = await finalPdfDoc.copyPages(pdfDoc, [0]);
      finalPdfDoc.addPage(copiedPage);
    }

    const pdfBytes = await finalPdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`PDF saved to ${outputPath}`);

    const pdfUrl = `/generated_pdfs/${path.basename(outputPath)}`;

    // Send response
    res.json({ message: 'PDF generated successfully', path: pdfUrl });

    // Send email in the background if user is authenticated
    if (req.user && req.user.userId) {
      sendGenerationReportEmail(req.user.userId, studentIds.length);
    } else {
      console.error('User not authenticated');
    }
  } catch (error) {
    console.error('Error in triggerPDFGeneration:', error);
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
};

module.exports = { triggerPDFGeneration };
