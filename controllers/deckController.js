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

        console.log(`Preview generated: `, preview.title);
        console.log(`Conversation thread: ${threadId}`);
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
        // Retrieve deck info (including threadId and syllabus) from db
        const { data: deck, error: deckRetrievalError } = await supabase
            .from('decks')
            .select('*')
            .eq('id', deckId)
            .eq('user_id', userId)
            .single()

        if (deckRetrievalError || !deck) {
            console.error('Error retrieving deck from db: ', deckRetrievalError);
            return res.status(404).json({ message: "Deck not found" });
        }

        if (deck.status !== 'preview') {
            console.error("Deck isn't in preview state, can't generate without syllabus")
            return res.status(400).json({ message: "Deck isn't in preview status, it's needed for deck creation"})
        }

        const threadId = deck.conversation;
        const syllabusModules = deck.preview_content.content.breakdown; // breakdown contains an array with all the modules

        // update specific deck (:deckId) status to 'generating' 
        await supabase
            .from('decks')
            .update({
                status: 'generating'
            })
            .eq('id', deckId)
            .eq('user_id', userId)

        // initialize modules variables for progress tracking and storing results of generated content
        let completedModules = 0;
        let finalContent = {
            title: deck.title,
            description: deck.description,
            content: {
                modules: []
            }
        }

        for (const module of syllabusModules) {
            // loop through modules: 
                // generate content
                // store module in db, at specific modules table
                // add to full_content variable (to be used to store og version in decks table)
                // update progress var and use it to update progress in db
                // send update to frontend (or use frontend polling)
            
            console.log()
            console.log('---')
            console.log(`For loop iteration. Currently at module: `, module.module.title);

            let moduleContent;
            try {
                moduleContent = await aiServices.generateDeckModuleContent(deck, module, threadId);
            } catch (error) {
                console.error(`Error generating module (${module.module.title}): `, error)
                return res.status(500).json({ message: 'Error generating module content' })
            }
            
            if (!moduleContent) {
                console.error(`Error loading generated information for "${module.module.title}" into moduleContent: `, moduleContent);
                return res.status(500).json({ message: 'Error loading generated info into moduleContent' })
            }

            console.log(`module created for "${module.module.title}": `, moduleContent);
            console.log('---')
            console.log()


            const { data: moduleInserted, error: moduleInsertionError } = await supabase
                .from('modules')
                .insert({
                    deck_id: deckId,
                    title: module.module.title,
                    description: module.module.description,
                    content: moduleContent
                })
                .select()
                .single()

            if (!moduleInserted || moduleInsertionError) {
                console.error('Failed inserting new module content into db: ', moduleInsertionError);
                return res.status(500).json({ message: "Failed inserting new module generated into db" })
            }

            completedModules += 1;
            finalContent.content.modules.push(moduleContent);

            // send update to frontend (could be via updates into a column of the db)
        }

        // after all modules are generated, update full_content in db
        const { data: fullDeck, error: fullDeckInsertionError } = await supabase
            .from('decks')
            .update({
                deck_content: finalContent,
            })
            .eq('user_id', userId)
            .eq('id', deckId)
            .select()
            .single()

        if (!fullDeck || fullDeckInsertionError) {
            console.error('Error inserting full deck content into db', fullDeckInsertionError);
            return res.status(500).json({ message: 'Error inserting full deck content into db' })
        }

        // update status to complete
        await supabase
            .from('decks')
            .update({
                status: 'complete'
            })
            .eq('id', deckId)
            .eq('user_id', userId)

        console.log(`Completed generation of deck "${fullDeck.title}"`)

        // respond to client with id of deck, and full_content
        return res.status(200).json({
            message: 'Deck created succesfully.',
            deck: fullDeck.deck_content
        })
        
    } catch (error) {
        console.error('Error in generating the full deck content at controller: ', error);
        res.status(500).json({ message: "Internal server error during generation of full content" })
    }

}

const getDecks = async (req, res) => {
    const userId = req.user.id;

    try {
        const { data: decks, error: decksRetrievalError } = await supabase
            .from('decks')
            .select('*')
            .eq('user_id', userId)

        if (!decks || decksRetrievalError) {
            console.error(`Error retrieving user (id: ${userId}) decks`, decksRetrievalError)
            return res.status(404).json({ message: 'Decks not found' })
        }

        // console.log(`Retrieved user decks succesfully (${userId}): `, decks);

        return res.status(200).json({
            message: 'Succesful retrieval',
            ok: true,
            decks: decks
        })

    } catch (error) {
        console.error('Failed retrieval of user decks', error);
        return res.status(500).json({
            message: `Internal error during retrieval`,
            user: userId,
            error: error
        })
    }
}

const getDeckContent = async (req, res) => {
    const deckId = req.params.deckId;
    const userId = req.user.id;

    try {
        // retrieve deck data from db (title and description)
        const { data: deckInfo, error: deckInfoRetrievalError } = await supabase
            .from('decks')
            .select('*')
            .eq('user_id', userId)
            .eq('id', deckId)
            .single()

        if (!deckInfo || deckInfoRetrievalError) {
            console.error(`Error retrieving deck info (deck id: ${deckId}), from db in deckController: `, deckInfoRetrievalError)
            return res.status(404).json({ message: 'Deck info not found'})
        }

        // retrieve deck modules from db
        const { data: modules, error: modulesRetrievalError } = await supabase
            .from('modules')
            .select('*')
            .eq('deck_id', deckId)

        if (!modules || modulesRetrievalError) {
            console.error(`Error retrieving modules for deck ${deckId}, from db in deckController: `, modulesRetrievalError);
            return res.status(404).json({ message: 'Deck modules not found'})
        }

        return res.status(200).json({
            message: 'Succesful retrieval',
            ok: true,
            deckInfo: deckInfo,
            modules: modules
        })
        
    } catch (error) {
        console.error(`Failed retrieval of deck contents (deck id: ${deckId}): `, error);
        return res.status(500).json({
            message: `Internal error during retrieval of deck's content`,
            deckId: deckId,
            error: error
        })
    }
}

module.exports = {
    createSyllabus,
    createDeck,
    getDecks,
    getDeckContent
}