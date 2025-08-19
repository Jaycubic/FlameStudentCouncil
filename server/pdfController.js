const { PDFDocument, StandardFonts } = require('pdf-lib');
const path = require('path');
const fs = require('fs');
const { getStudentsByIdsForPDF } = require('../service/studentService');

// Define PHOTO_OFFSET with a default value (adjust as needed)
const PHOTO_OFFSET = 1; // Replace with actual value or calculation

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

// Field bounds from InDesign JSON (converted to points: inches * 72)
const fieldBounds = {
  0: {
    Name: [0.99616310014396 * 72, 1.57385826771528 * 72, 1.24692690002325 * 72, 3.01385826771528 * 72],
    StudentID: [1.28505198903285 * 72, 1.57385826771528 * 72, 1.43905048519442 * 72, 2.43385826771528 * 72],
    DOB: [1.4668282629722 * 72, 2.13163604549306 * 72, 1.5791600924671 * 72, 2.99163604549306 * 72],
    Validity: [1.62082675913376 * 72, 2.12885826771528 * 72, 1.73315858862866 * 72, 2.89685826771528 * 72],
    Blood: [1.77482525529533 * 72, 2.1340804899375 * 72, 1.88715708479023 * 72, 2.9940804899375 * 72],
    Batch: [1.77482525529533 * 72, 3.57385826771528 * 72, 1.93305048519442 * 72, 3.77385826771528 * 72],
    Photo: [0.94505048519442 * 72, 0.5735 * (-PHOTO_OFFSET) * 72, 1.93305048519442 * 72, 1.3415 * 72]
  },
  1: {
    Name: [3.28621854020627 * 72, 1.57880127002935 * 72, 3.53698234008556 * 72, 3.01880127002935 * 72],
    StudentID: [3.57510742909516 * 72, 1.57880127002935 * 72, 3.72910592525673 * 72, 2.43880127002935 * 72],
    DOB: [3.75688370303451 * 72, 2.13657904780713 * 72, 3.8692155325294 * 72, 2.99657904780713 * 72],
    Validity: [3.91088219919607 * 72, 2.13380127002935 * 72, 4.02321402869097 * 72, 2.90180127002935 * 72],
    Blood: [4.06488069535764 * 72, 2.13902349225157 * 72, 4.17721252485254 * 72, 2.99902349225157 * 72],
    Batch: [4.06488069535764 * 72, 3.57880127002935 * 72, 4.22310592525673 * 72, 3.77880127002935 * 72],
    Photo: [3.23510592525673 * 72, 0.57844300231407 * 72, 4.22310592525673 * 72, 1.34644300231407 * 72]
  },
  2: {
    Name: [5.57627398026858 * 72, 1.56854986876389 * 72, 5.82703778014787 * 72, 3.00854986876389 * 72],
    StudentID: [5.86516286915747 * 72, 1.56854986876389 * 72, 6.01916136531904 * 72, 2.42854986876389 * 72],
    DOB: [6.04693914309681 * 72, 2.12632764654167 * 72, 6.15927097259171 * 72, 2.98632764654167 * 72],
    Validity: [6.20093763925838 * 72, 2.12354986876389 * 72, 6.31326946875328 * 72, 2.89154986876389 * 72],
    Blood: [6.35493613541995 * 72, 2.12877209098611 * 72, 6.46726796491485 * 72, 2.98877209098611 * 72],
    Batch: [6.35493613541995 * 72, 3.56854986876389 * 72, 6.51316136531904 * 72, 3.76854986876389 * 72],
    Photo: [5.52516136531904 * 72, 0.56819160104861 * 72, 6.51316136531904 * 72, 1.33619160104861 * 72]
  },
  3: {
    Name: [7.87215777907722 * 72, 1.57880127002935 * 72, 8.12292157895651 * 72, 3.01880127002935 * 72],
    StudentID: [8.16104666796611 * 72, 1.57880127002935 * 72, 8.31504516412768 * 72, 2.43880127002935 * 72],
    DOB: [8.34282294190545 * 72, 2.13657904780713 * 72, 8.45515477140035 * 72, 2.99657904780713 * 72],
    Validity: [8.49682143806702 * 72, 2.13380127002935 * 72, 8.60915326756192 * 72, 2.90180127002935 * 72],
    Blood: [8.65081993422859 * 72, 2.13902349225157 * 72, 8.76315176372349 * 72, 2.99902349225157 * 72],
    Batch: [8.65081993422859 * 72, 3.57880127002935 * 72, 8.80904516412768 * 72, 3.77880127002935 * 72],
    Photo: [7.82104516412768 * 72, 0.57844300231407 * 72, 8.80904516412768 * 72, 1.34644300231407 * 72]
  },
  4: {
    Name: [10.1680415778859 * 72, 1.57880127002935 * 72, 10.4188053777651 * 72, 3.01880127002935 * 72],
    StudentID: [10.4569304667748 * 72, 1.57880127002935 * 72, 10.6109289629363 * 72, 2.43880127002935 * 72],
    DOB: [10.6387067407141 * 72, 2.13657904780713 * 72, 10.751038570209 * 72, 2.99657904780713 * 72],
    Validity: [10.7927052368757 * 72, 2.13380127002935 * 72, 10.9050370663706 * 72, 2.90180127002935 * 72],
    Blood: [10.9467037330372 * 72, 2.13902349225157 * 72, 11.0590355625321 * 72, 2.99902349225157 * 72],
    Batch: [10.9467037330372 * 72, 3.57880127002935 * 72, 11.1049289629363 * 72, 3.77880127002935 * 72],
    Photo: [10.1169289629363 * 72, 0.57844300231407 * 72, 11.1049289629363 * 72, 1.34644300231407 * 72]
  }
};

// Field styling: { label, key, fontSize }
const fieldStyles = {
  Name: { key: 'StudentName', fontSize: 10 },
  StudentID: { key: 'StudentCvueNo', fontSize: 8 },
  DOB: { key: 'DOB', fontSize: 8 },
  Validity: { key: 'Validity', fontSize: 8 },
  Blood: { key: 'Blood', fontSize: 8 },
  Batch: { key: 'Batch', fontSize: 8 }
};

const triggerPDFGeneration = async (req, res) => {
  try {
    const { studentIds } = req.body;
    console.log('Received studentIds (StudentCvueNo):', studentIds);

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ message: 'Student IDs are required and must be an array' });
    }

    const parsedStudentCvueNos = studentIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
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
        StudentCvueNo: student.StudentCvueNo || 'N/A',
        DOB: student.DOB ? new Date(student.DOB).toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric'
        }) : 'N/A',
        Validity: student.Validity || 'N/A',
        Blood: student.Blood || 'N/A',
        Batch: student.Batch || 'N/A',
        Photo: photoBase64
      };
    });

    // Define paths for template and output
    const templatePath = '/opt/View/StudentTrackingSystem/server/controllers/IDtemplate.pdf';
    const outputDir = '/opt/View/StudentTrackingSystem/server/generated_pdfs';
    const timestamp = Date.now();
    const outputPath = path.join(outputDir, `student_ids_${timestamp}.pdf`);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Load the PDF template
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Embed the Helvetica font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Get the first page (adjust if multiple pages are needed)
    const page = pdfDoc.getPage(0);

    // Draw text and images for each student
    for (let i = 0; i < studentsForPDF.length; i++) {
      const student = studentsForPDF[i];
      const slot = i % 5; // Assuming 5 students per page

      // Draw text fields
      for (const [label, { key, fontSize }] of Object.entries(fieldStyles)) {
        if (slot in fieldBounds && label in fieldBounds[slot]) {
          const [x1, y1, x2, y2] = fieldBounds[slot][label];
          const text = student[key] || 'N/A';
          // Calculate width and height
          const width = x2 - x1;
          const height = y2 - y1;
          // Adjust font size to fit (basic scaling)
          let adjustedFontSize = fontSize;
          const textWidth = font.widthOfTextAtSize(text, fontSize);
          if (textWidth > width * 0.9) {
            adjustedFontSize = fontSize * (width * 0.9 / textWidth);
          }
          // Center text vertically
          const textHeight = font.heightAtSize(adjustedFontSize);
          const yOffset = y1 + (height - textHeight) / 2;
          page.drawText(text, {
            x: x1,
            y: yOffset,
            size: adjustedFontSize,
            font,
            maxWidth: width
          });
          console.log(`Drew ${label} for student ${slot} at (${x1}, ${yOffset}): ${text}`);
        } else {
          console.warn(`No bounds for ${label} in slot ${slot}`);
        }
      }

      // Draw photo
      if (student.Photo && slot in fieldBounds && 'Photo' in fieldBounds[slot]) {
        try {
          const [x1, y1, x2, y2] = fieldBounds[slot].Photo;
          const imageBytes = Buffer.from(student.Photo, 'base64');
          const image = await pdfDoc.embedJpg(imageBytes); // Use embedPng if PNG
          const width = x2 - x1;
          const height = y2 - y1;
          page.drawImage(image, {
            x: x1,
            y: y1,
            width,
            height
          });
          console.log(`Photo drawn for student ${slot} (${student.StudentName}) at (${x1}, ${y1})`);
        } catch (err) {
          console.warn(`Error drawing photo for student ${slot} (${student.StudentName}):`, err);
        }
      }
    }

    // Save the modified PDF
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
    console.log(`PDF saved to ${outputPath}`);

    const pdfUrl = `/generated_pdfs/${path.basename(outputPath)}`;
    res.json({ message: 'PDF generated successfully', path: pdfUrl });
  } catch (error) {
    console.error('Error in triggerPDFGeneration:', error);
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
};

module.exports = { triggerPDFGeneration };
