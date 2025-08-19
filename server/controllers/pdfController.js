const { PDFDocument, StandardFonts, PDFName, PDFNumber, rgb } = require('pdf-lib');
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

const sendGenerationReportEmail = async (userId, numberOfIds) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) return console.error('User not found for ID:', userId);
    const generationTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const emailContent = `
      <h2>ID Card Generation Report</h2>
      <p><strong>User:</strong> ${user.username} (${user.email})</p>
      <p><strong>Number of IDs generated:</strong> ${numberOfIds}</p>
      <p><strong>Date and Time:</strong> ${generationTime}</p>
    `;
    await transporter.sendMail({
      from: `"FLAME STS" <${process.env.EMAIL_USER}>`,
      to: 'adminsctsc@flame.edu.in',
      cc: 'adminsctsc@flame.edu.in',
      subject: 'ID Card Generation Report',
      html: emailContent,
    });
  } catch (err) {
    console.error('Error sending email:', err);
  }
};

const getPhotoPath = (photoId) => {
  const photoDir = '/opt/View/StudentTrackingSystem/server/Photos';
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    const file = path.join(photoDir, `${photoId}${ext}`);
    if (fs.existsSync(file)) return file;
  }
  console.warn(`Photo not found for ID ${photoId}`);
  return null;
};

// Helper function to format dates as DD-MM-YYYY
const formatDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
};

const triggerPDFGeneration = async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Student IDs are required and must be an array' });
    }

    const ids = studentIds.map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) {
      return res.status(400).json({ message: 'All student IDs must be valid numbers' });
    }

    const students = await getStudentsByIdsForPDF(ids);
    if (!students.length) {
      return res.status(404).json({ message: 'No students found for those IDs' });
    }

    // Prepare student data with DOB and Validity formatted as DD-MM-YYYY
    const studentsForPDF = students.map(s => {
      const photoPath = getPhotoPath(s.Photo);
      let photoBase64 = null;
      if (photoPath) {
        try {
          photoBase64 = fs.readFileSync(photoPath).toString('base64');
        } catch (e) {
          console.error('Photo encode error:', e);
        }
      }
      return {
        StudentName: s.StudentName || 'N/A',
        StudentCvueNo: s.StudentCvueNo?.toString() || 'N/A',
        DOB: formatDate(s.DOB),
        Validity: formatDate(s.Validity),
        Blood: s.BloodGroup || 'N/A',
        Batch: s.Batch || 'N/A',
        Photo: photoBase64
      };
    });

    // Paths
    const templatePath = '/opt/View/StudentTrackingSystem/server/controllers/IDtemplate.pdf';
    const outputDir = '/opt/View/StudentTrackingSystem/server/generated_pdfs';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `student_ids_${Date.now()}.pdf`);

    // Load template
    const templateBytes = fs.readFileSync(templatePath);
    const finalDoc = await PDFDocument.create();
    const studentsPerPage = 5;
    const pagesNeeded = Math.ceil(studentsForPDF.length / studentsPerPage);

    // Font reference
    const nameFont = StandardFonts.HelveticaBold;

    for (let p = 0; p < pagesNeeded; p++) {
      const pdf = await PDFDocument.load(templateBytes);
      const form = pdf.getForm();
      const boldFont = await pdf.embedFont(nameFont);
      const page = pdf.getPages()[0];

      const slice = studentsForPDF.slice(p * studentsPerPage, (p + 1) * studentsPerPage);

      // 1) Fill text fields: Name, StudentID, DOB, Validity, Blood
      for (let i = 0; i < slice.length; i++) {
        const student = slice[i];
        const slot = i + 1; // 1–5
        for (const label of ['Name', 'StudentID', 'DOB', 'Validity', 'Blood']) {
          const fieldName = label + (slot > 1 ? ` ${slot}` : '');
          try {
            const field = form.getTextField(fieldName);
            let txt;
            if (label === 'Name') txt = student.StudentName;
            else if (label === 'StudentID') txt = student.StudentCvueNo;
            else {
              // DOB, Validity, Blood
              const key = label === 'DOB' ? 'DOB' : label === 'Validity' ? 'Validity' : 'Blood';
              txt = `: ${student[key]}`;
            }
            field.setText(txt);
            const size = (label === 'Name' || label === 'StudentID') ? 10 : 8;
            field.setFontSize(size);
            field.updateAppearances(boldFont);
          } catch (_) {
            // field might not exist on template—ignore
          }
        }
      }

      // 2) Draw Batch manually in white
      for (let i = 0; i < slice.length; i++) {
        const student = slice[i];
        let batch = student.Batch;
        if (typeof batch === 'string' && batch.startsWith('PH') && batch.length > 3) {
          batch = batch.slice(0, 3);
        }
        const fieldName = 'Batch' + (i > 0 ? ` ${i + 1}` : '');
        try {
          const acroField = form.getTextField(fieldName).acroField;
          acroField.dict.set(PDFName.of('MaxLen'), PDFNumber.of(3));
          const widget = acroField.getWidgets()[0];
          const { x, y, width, height } = widget.getRectangle();

          const fontSize = 8;
          const textWidth = boldFont.widthOfTextAtSize(batch, fontSize);
          const textHeight = boldFont.heightAtSize(fontSize);
          const drawX = x + (width - textWidth) / 2;
          const drawY = y + (height - textHeight) / 2;

          page.drawText(batch, {
            x: drawX,
            y: drawY,
            size: fontSize,
            font: boldFont,
            color: rgb(1, 1, 1),
          });
        } catch (e) {
          console.warn(`Batch draw failed for ${fieldName}:`, e);
        }
      }

      // 3) **Re‑added**: Place photos
      for (let i = 0; i < slice.length; i++) {
        const student = slice[i];
        if (!student.Photo) continue; // skip if no photo
        const slotIndex = i + 1;
        const photoFieldName = slotIndex === 1 ? 'Photo' : `Photo ${slotIndex}`;
        try {
          const photoField = form.getTextField(photoFieldName);
          const widgets = photoField.acroField.getWidgets();
          if (widgets.length) {
            const widget = widgets[0];
            const rect = widget.getRectangle();
            const imageBytes = Buffer.from(student.Photo, 'base64');
            // Try JPG first; if it fails use PNG
            let embeddedImage;
            try {
              embeddedImage = await pdf.embedJpg(imageBytes);
            } catch {
              embeddedImage = await pdf.embedPng(imageBytes);
            }
            // scale to fit
            const scale = Math.min(rect.width / embeddedImage.width, rect.height / embeddedImage.height);
            const w = embeddedImage.width * scale;
            const h = embeddedImage.height * scale;
            const x = rect.x + (rect.width - w) / 2;
            const y = rect.y + (rect.height - h) / 2;
            page.drawImage(embeddedImage, { x, y, width: w, height: h });
          }
        } catch (err) {
          console.warn(`Error placing photo for ${photoFieldName}:`, err);
        }
      }

      form.flatten();
      const [copiedPage] = await finalDoc.copyPages(pdf, [0]);
      finalDoc.addPage(copiedPage);
    }

    // Save and write
    const pdfBytes = await finalDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`PDF saved to ${outputPath}`);

    const pdfUrl = `/generated_pdfs/${path.basename(outputPath)}`;
    res.json({ message: 'PDF generated successfully', path: pdfUrl });

    // Send email report if authenticated
    if (req.user?.userId) {
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
