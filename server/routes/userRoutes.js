// server/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// User management routes
router.get('/', validateToken, requireAdmin, userController.getAllUsers);
router.post('/', userController.createUser);

// More specific PUT comes before the generic `/:id`
router.put('/update-password', validateToken, userController.updateMyPassword);
router.put('/:id/role', validateToken, userController.updateUserRole);

// Now the generic `/:id` routes
router.get('/:id', validateToken, userController.getUserById);
router.put('/:id', validateToken, userController.updateUser);
router.delete('/:id', validateToken, userController.deleteUser);

module.exports = router;
