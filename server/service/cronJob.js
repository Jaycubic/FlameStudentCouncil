const { getStudentsForPDF, generateStudentIDs } = require('../controllers/pdfController');
const StudentData = require("../models/StudentData");
const sequelize = require("../config/database");

// Function to generate PDFs for all batches on demand
const generateAllBatchPDFs = async () => {
  try {
    console.log('Starting on-demand PDF generation for all batches...');
    const batches = await StudentData.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('Batch')), 'Batch']],
      raw: true,
    });

    for (const { Batch } of batches) {
      const students = await getStudentsForPDF(Batch);
      if (students.length > 0) {
        const pdfPath = await generateStudentIDs(students);
        console.log(`Generated PDF for batch ${Batch} at ${pdfPath}`);
      }
    }
    console.log('On-demand PDF generation completed.');
    return true;
  } catch (error) {
    console.error('Error in generateAllBatchPDFs:', error);
    throw error;
  }
};

// For testing purposes
const runImmediateGeneration = async () => {
  try {
    const students = await getStudentsForPDF('UGLE2024'); // Example batch
    if (students.length > 0) {
      const pdfPath = await generateStudentIDs(students);
      console.log(`Immediate PDF generated at ${pdfPath}`);
    }
  } catch (error) {
    console.error('Error in immediate generation:', error);
  }
};

module.exports = { generateAllBatchPDFs, runImmediateGeneration };
