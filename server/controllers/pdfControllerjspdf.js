const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const StudentData = require("../models/StudentData");
const sequelize = require("../config/database");
const redis = require('redis');
const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect();

// Positioning constants (assumed from Size.pdf)
const ID_POSITIONS = [
  { x: 50, y: 700, width: 200, height: 300 },
  { x: 300, y: 700, width: 200, height: 300 },
  { x: 550, y: 700, width: 200, height: 300 },
  { x: 50, y: 350, width: 200, height: 300 },
  { x: 300, y: 350, width: 200, height: 300 },
];
const PHOTO_POS = { x: 10, y: 250, width: 100, height: 100 };
const NAME_POS = { x: 10, y: 200 };
const BATCH_POS = { x: 10, y: 180 };
const DOB_POS = { x: 10, y: 160 };

// Fetch students by StudentCvueNo for PDF
const getStudentsByIdsForPDF = async (studentCvueNos) => {
  try {
    console.log('Fetching students for StudentCvueNo:', studentCvueNos);
    const cachedKey = `studentsForPDF:cvue:${studentCvueNos.join(',')}`;
    const cachedData = await redisClient.get(cachedKey);
    if (cachedData) {
      console.log(`Serving students for StudentCvueNo from Redis cache`);
      return JSON.parse(cachedData);
    }

    const students = await StudentData.findAll({
      attributes: ['StudentName', 'Batch', 'DOB', 'Photo'],
      where: { StudentCvueNo: studentCvueNos },
      raw: true,
    });

    console.log('Database query returned students:', students);

    const formattedStudents = students.map(student => ({
      ...student,
      Batch: student.Batch ? student.Batch.slice(0, 2) : 'NA',
    }));

    if (formattedStudents.length > 0) {
      await redisClient.setEx(cachedKey, 600, JSON.stringify(formattedStudents));
      console.log('Cached students for key:', cachedKey);
    } else {
      console.log('No students found, skipping cache');
    }

    return formattedStudents;
  } catch (error) {
    console.error('Error in getStudentsByIdsForPDF:', error);
    throw error;
  }
};

// Fetch student photo
const getStudentPhotoPath = async (photoId) => {
  try {
    const photoDir = '/opt/View/StudentTrackingSystem/server/Photos';
    const extensions = ['.jpg', '.jpeg', '.png'];
    for (const ext of extensions) {
      const filePath = path.join(photoDir, `${photoId}${ext}`);
      try {
        await fs.access(filePath);
        return filePath;
      } catch (error) {
        // File not found, try next extension
      }
    }
    return null;
  } catch (error) {
    console.error('Error in getStudentPhotoPath:', error);
    throw error;
  }
};

// Generate PDF with student IDs
const generateStudentIDs = async (students) => {
  try {
    const templatePath = '/opt/View/StudentTrackingSystem/server/controllers/IDtemplate.pdf';
    const templateBytes = await fs.readFile(templatePath);
    const templatePdf = await PDFDocument.load(templateBytes);
    const [templatePage] = templatePdf.getPages();

    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const studentsPerPage = 5;
    const totalPages = Math.ceil(students.length / studentsPerPage);

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      const newPage = pdfDoc.addPage([templatePage.getWidth(), templatePage.getHeight()]);
      const embeddedPage = await pdfDoc.embedPage(templatePage);
      newPage.drawPage(embeddedPage);

      const start = pageNum * studentsPerPage;
      const end = Math.min(start + studentsPerPage, students.length);
      const pageStudents = students.slice(start, end);

      for (let i = 0; i < pageStudents.length; i++) {
        const student = pageStudents[i];
        const idPosition = ID_POSITIONS[i];

        // Add photo with placeholder
        const photoPath = await getStudentPhotoPath(student.Photo) ||
          '/opt/View/StudentTrackingSystem/server/Photos/default-user.jpg';
        const photoBuffer = await sharp(photoPath)
          .resize(PHOTO_POS.width, PHOTO_POS.height)
          .jpeg()
          .toBuffer();
        const photoImage = await pdfDoc.embedJpg(photoBuffer);
        newPage.drawImage(photoImage, {
          x: idPosition.x + PHOTO_POS.x,
          y: idPosition.y + PHOTO_POS.y,
          width: PHOTO_POS.width,
          height: PHOTO_POS.height,
        });

        // Add text with fixed DOB handling
        const nameText = student.StudentName || 'Unknown';
        const batchText = student.Batch;
        const dobText = student.DOB
          ? new Date(student.DOB).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric'
            })
          : 'N/A';

        newPage.drawText(nameText, {
          x: idPosition.x + NAME_POS.x,
          y: idPosition.y + NAME_POS.y,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        newPage.drawText(batchText, {
          x: idPosition.x + BATCH_POS.x,
          y: idPosition.y + BATCH_POS.y,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
        newPage.drawText(dobText, {
          x: idPosition.x + DOB_POS.x,
          y: idPosition.y + DOB_POS.y,
          size: 12,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join('/opt/View/StudentTrackingSystem/server/generated_pdfs',
      `student_ids_${Date.now()}.pdf`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, pdfBytes);
    return outputPath;
  } catch (error) {
    console.error('Error in generateStudentIDs:', error);
    throw error;
  }
};

// API endpoint to trigger PDF generation by StudentCvueNo
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
    const pdfPath = await generateStudentIDs(students);
    const pdfUrl = `/generated_pdfs/${path.basename(pdfPath)}`;
    res.json({ message: 'PDF generated successfully', path: pdfUrl });
  } catch (error) {
    console.error('Error in triggerPDFGeneration:', error);
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
};

module.exports = {
  triggerPDFGeneration,
  generateStudentIDs,
};
