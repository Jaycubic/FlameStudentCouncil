const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { validateToken } = require('../middleware/auth');

router.get('/', validateToken, departmentController.getAllDepartments);
router.post('/', validateToken, departmentController.createDepartment);
router.get('/:id', validateToken, departmentController.getDepartmentById);
router.put('/:id', validateToken, departmentController.updateDepartment);
router.delete('/:id', validateToken, departmentController.deleteDepartment);

module.exports = router;
