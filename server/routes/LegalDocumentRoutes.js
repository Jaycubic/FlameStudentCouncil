const express = require('express');
const router = express.Router();

const {
  saveLegalDocument,
  getLegalDocuments,
  getLegalDocumentById,
  updateLegalDocument,
  deleteLegalDocument
} = require('../controllers/LegalDocumentController');

// Corrected routes without duplicate '/legal-documents' prefix
router.post('/', saveLegalDocument);          // POST /legal-documents
router.get('/', getLegalDocuments);           // GET /legal-documents
router.get('/:id', getLegalDocumentById);     // GET /legal-documents/:id
router.patch('/:id', updateLegalDocument);    // PATCH /legal-documents/:id
router.delete('/:id', deleteLegalDocument);   // DELETE /legal-documents/:id

module.exports = router;
