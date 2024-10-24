const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { 
    createSyllabus,
    createDeck
} = require('../controllers/deckController')
const { createSyllabusValidation } = require('../validators/deckValidation')

// Pending adding validation (deckValidation.js) to the deck req
// router.post('/syllabus', authenticateToken, createSyllabusValidation, createSyllabus);
router.post('/syllabus', authenticateToken, createSyllabus);
router.put('/:deckId', authenticateToken, createDeck)

module.exports = router;