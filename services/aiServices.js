const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const generateDeckPreview = async (deckData) => {
    // code
    try {
        const assistantId = process.env.OPENAI_ASSISTANT_ID;

        // Step 1: retrieve thread from database, if no thread create new one
    } catch (error) {
        
    }
}

module.exports = {
    generateDeckPreview
}