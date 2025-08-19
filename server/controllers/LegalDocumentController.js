const LegalDocument = require("../models/LegalDocument");

const isLegalDocumentValid = (data) => {
  let errorList = [];
  if (!data.type) errorList.push("Document type is required");
  if (!data.content) errorList.push("Document content is required");
  return errorList.length > 0 ? { status: false, errors: errorList } : { status: true };
};

const saveLegalDocument = async (req, res) => {
  try {
    const { type, content } = req.body;
    const documentData = { type, content };
    const validation = isLegalDocumentValid(documentData);
    if (!validation.status) {
      return res.status(400).json({ message: "error", errors: validation.errors });
    }
    const savedDocument = await LegalDocument.create(documentData);
    res.status(201).json({ message: "success", data: savedDocument });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLegalDocuments = async (req, res) => {
  try {
    const documents = await LegalDocument.findAll();
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLegalDocumentById = async (req, res) => {
  try {
    const document = await LegalDocument.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: "Document not found" });
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateLegalDocument = async (req, res) => {
  try {
    const { type, content } = req.body;
    const document = await LegalDocument.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: "Document not found" });
    const documentData = { type, content };
    const validation = isLegalDocumentValid(documentData);
    if (!validation.status) {
      return res.status(400).json({ message: "error", errors: validation.errors });
    }
    await LegalDocument.update(documentData, { where: { id: req.params.id } });
    const updatedDocument = await LegalDocument.findByPk(req.params.id);
    res.status(200).json({ message: "success", data: updatedDocument });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteLegalDocument = async (req, res) => {
  try {
    const document = await LegalDocument.findByPk(req.params.id);
    if (!document) return res.status(404).json({ message: "Document not found" });
    await LegalDocument.destroy({ where: { id: req.params.id } });
    res.status(200).json({ message: "Document deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  saveLegalDocument,
  getLegalDocuments,
  getLegalDocumentById,
  updateLegalDocument,
  deleteLegalDocument
};
