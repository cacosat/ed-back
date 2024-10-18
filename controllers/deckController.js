const supabase = require('../config/supabase');
const { validationResult } = require('express-validator');
const aiServices = require('../services/aiServices');

const createDeck = async (req, res) => {
    // handle validation
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        console.error('Validation for creating deck failed')
        return res.status(400).json({ errors: validationErrors.array() })
    }

    // extract creation data from req
    const data = req.body.data; // keywords, description, difficulty, questionCount
    const userId = req.user.id; // from auth middleware in the routes file

    try {
        // insert creation data to db
        const { data: newDeck, error: deckInsertionError } = await supabase
            .from('decks')
            .insert({
                user_id: userId, 
                creation_data: data,
                status: 'creating'
            })
            .select()
            .single()

        if (deckInsertionError) {
            console.error('New deck creation_data couldnt be inserted into the db: ', deckInsertionError);
            return res.status(500).json({ message: 'Error inserting creation data into db' })
        }

        // generate preview with ai
        console.log('---');
        console.log('Sending preview request to OAI...');
        console.log('');

        let preview;
        try {
            preview = await aiServices.generateDeckPreview(data);
        } catch (aiError) {
            console.error('Error generating deck preview with AI: ', aiError);
            return res.status(500).json({ message: 'Failed to generate deck preview with AI.' });
        }

        if (!preview || !preview.objectives || !preview.content) {
            console.error('Invalid preview data received from OAI within deckController');
            return res.status(500).json({ message: 'Invalid preview data received from OAI within deckController.' });
        }          

        console.log(`Preview generated: `, preview);
        console.log('---');

        // update preview in db
        const { data: deckPreview, error: previewInsertionError } = await supabase
            .from('decks')
            .update({
                title: preview.title,
                preview_content: preview,
                preview_explanation: preview.explanation,
                status: 'preview'
            })
            .eq('id', newDeck.id)
            .select()
            .single()

        if (previewInsertionError) {
            console.error('Error inserting deck preview into db: ', previewInsertionError);
            return res.status(500).json({ message: 'Failed insertion of deck preview into db'})
        }

        return res.status(201).json({
            deckId: newDeck.id,
            preview: {
                content: deckPreview.preview_content,
                explanation: deckPreview.preview_explanation
            },
            status: 'preview'
        })

    } catch (error) {
        console.error('Failed creation of deck: ', error);
        return res.status(500).json({ message: 'Server error creating the deck, failed.' })
    }
}

module.exports = {
    createDeck
}