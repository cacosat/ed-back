const { body } = require('express-validator');

createSyllabusValidation = [
    body('title')
        .notEmpty()
        .withMessage('Title is required.')
        .isString()
        .withMessage('Title must be a string.'),
    body('description')
        .notEmpty()
        .withMessage('Description is required.')
        .isString()
        .withMessage('Description must be a string.'),
    body('keywords')
        .isArray({ min: 1, max: 20 })
        .withMessage('Keywords should be an array with at least one keyword and a max of 20.'),
    body('difficultyLevel')
        .notEmpty()
        .withMessage('Difficulty level is required.')
        .isIn(['Easy', 'Medium', 'Hard'])
        .withMessage('Difficulty level must be Easy, Medium, or Hard.'),
    body('questionCount')
        .isInt({ min: 1 })
        .withMessage('Question count must be a positive integer.'),
];

module.exports = {
    createSyllabusValidation
}