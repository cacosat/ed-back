const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// console.log('imported authController functions: ', authController);

const { register, login, refreshToken, logout } = authController;

// registration route
router.post('/register', register);

// login route
router.post('/login', login);

// token refresh route
router.post('/refresh-token', refreshToken);

// logout route
router.post('/logout', authenticateToken, logout);

module.exports = router;