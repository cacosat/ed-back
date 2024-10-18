const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { deckController } = require('../controllers/deckController')
const { createDeckValidation } = require('../validators/deckValidation')

router.post('/deck', authenticateToken, createDeckValidation, deckController.createDeck);

module.exports = router;