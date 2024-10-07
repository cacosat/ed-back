const express = require('express');
const router = express.Router(); 
const { authenticateToken } = require('../middleware/authMiddleware');

// protected route
router.get('/', authenticateToken, (req, res) => {
    res.json({
        message: "You've accessed a protected route",
        userId: req.user.id
    })
})

module.exports = router;