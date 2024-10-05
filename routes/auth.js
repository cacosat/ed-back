const express = require('express');
const router = express.Router();

const { register, login, refreshToken, logout } = require('../controllers/authController');

// registration route
router.post('/register', register);

// login route
router.post('/login', login);

// token refresh route
router.post('/refresh-token', refreshToken);

// logout route
router.post('/logout', logout);

module.exports = router;