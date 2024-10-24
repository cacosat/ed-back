const supabase = require('../config/supabase');
const { validationResult } = require('express-validator');
const aiServices = require('../services/aiServices');

const createSyllabus = async (req, res) => {
    // handle validation
    // const validationErrors = validationResult(req);
    // if (!validationErrors.isEmpty()) {
    //     console.error('Validation for creating deck failed')
    //     return res.status(400).json({ errors: validationErrors.array() })
    // }

    // extract creation data from req
    const data = req.body; // keywords, description, difficulty (fixed)
    const userId = req.user.id; // from auth middleware in the routes file

    if (!data) { // || !data.description || !data.keywords
        console.error('Invalid request data:', data);
        return res.status(400).json({ message: 'Invalid request data. Missing required fields.' });
    }

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
        console.log('Sending preview request to OAI with: ', data);
        console.log('');

        let preview;
        let threadId;
        try {
            ({ preview, threadId } = await aiServices.generateDeckSyllabus(data));
        } catch (aiError) {
            console.error('Error generating deck preview with AI: ', aiError);
            return res.status(500).json({ message: 'Failed to generate deck preview with AI.' });
        }

        console.log(`Preview generated: `, preview);
        console.log('---');
        
        if (!preview) {
            console.error('Invalid preview data received from OAI within deckController');
            return res.status(500).json({ message: 'Invalid preview data received from OAI within deckController.' });
        }          

        // update preview in db
        const { data: deckPreview, error: previewInsertionError } = await supabase
            .from('decks')
            .update({
                title: preview.title,
                description: preview.explanation,
                preview_content: preview,
                conversation: threadId,
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
                thread: threadId
            },
            status: 'preview'
        })

    } catch (error) {
        console.error('Failed creation of deck: ', error);
        return res.status(500).json({ message: 'Server error creating the deck, failed.' })
    }
}

const createDeck = async (req, res) => {
    // handle validation with express-validator

    const deckId = req.params.deckId; // param from dynamic route '/decks/:deckId'
    const userId = req.user.id; // from auth middleware
    
    try {
        // Retrieve conversation (threadId) and preview_content (syllabus) from db for the user's specific deck

        // update specific deck (:deckId) status to 'generating'

        // make modules variables for progress tracking and storing results of generated content

        // loop through modules: 
            // generate content
            // add to full_content variable (to be used to store og version in decks table)
            // store module in db, at specific modules table
            // update progress var and use it to update progress in db
            // send update to frontend (or use frontend polling)

        // after all modules are generated, update full_content in db

        // update status to generated

        // respond to client with id of deck, and full_content
        
    } catch (error) {
        
    }

}

module.exports = {
    createSyllabus,
    createDeck
}