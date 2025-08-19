const express = require("express");
const router = express.Router();
const {
  issueKey,
  returnKey,
  getKeyStatus,
} = require("../controllers/keyIssueController");

router.post("/issue", issueKey);
router.post("/return", returnKey);
router.get("/status/:studentId", getKeyStatus);

module.exports = router;
