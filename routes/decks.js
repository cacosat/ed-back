const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { createSyllabus } = require('../controllers/deckController')
const { createSyllabusValidation } = require('../validators/deckValidation')

// Pending adding validation to the deck req
// router.post('/syllabus', authenticateToken, createSyllabusValidation, createSyllabus);
router.post('/syllabus', authenticateToken, createSyllabus);

module.exports = router;