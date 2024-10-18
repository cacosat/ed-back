const supabase = require('../config/supabase');
const { validationResult } = require('express-validator');
const aiServices = require('../services/aiServices') // Pending to be made

const createDeck = async (req, res) => {
    // handle validation
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
        console.error('Validation for creating deck failed')
        res.status(400).json({ errors: validationErrors.array() })
    }

    // extract creation data from req
    const data = req.body.data; // title, keywords, description, difficulty, questionCount
    const userId = req.user.id; // from auth middleware in the routes file

    try {
        // insert creation data to db
        const { data: newDeck, error: deckInsertionError } = await supabase
            .from('decks')
            .insert({
                user_id: userId, 
                title: data.title, 
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

        const preview = await aiServices.generateDeckPreview(data)

        console.log(`Preview generated: `, preview);
        console.log('---');

        // update preview in db
        const { data: deckPreview, error: previewInsertionError } = await supabase
            .from('decks')
            .update({
                preview_content: preview.content,
                preview_explanation: preview.explanation
            })
            .eq('id', newDeck.id)
            .select()
            .single()

        if (previewInsertionError) {
            console.error('Error inserting deck preview into db: ', previewInsertionError);
            return res.status(500).json({ message: 'Failed insertion of deck preview into db'})
        }

        return res.staus(201).json({
            deckId: newDeck.id,
            preview: {
                content: deckPreview.content,
                explanation: deckPreview.explanation
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