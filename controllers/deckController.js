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

const generateDeckContent = async (deck, userId) => {
    const deckId = deck.id;
    const threadId = deck.conversation;
    const syllabusModules = deck.preview_content.content.breakdown; // breakdown contains an array with all the modules
    let completedModules = 0;
    let numOfQuestions = 0;

    console.log('Starting creation of deck content')

    for (const module of syllabusModules) {
        // loop through modules: 
            // generate content
            // store module in db, at specific modules table
            // add to full_content variable (to be used to store og version in decks table)
            // update progress var and use it to update progress in db
            // send update to frontend (or use frontend polling)
        
        console.log('---')
        console.log(`For loop iteration. Currently at module: `, module.module.title);

        try {
            const moduleContent = await aiServices.generateDeckModuleContent(deck, module, threadId);

            if (!moduleContent) {
                console.error(`Error loading generated information for "${module.module.title}" into moduleContent: `, moduleContent);
                return res.status(500).json({ message: 'Error loading generated info into moduleContent' })
            }

            // num of questions per module  
            // for loop over module.subtopics (array),
            // and then take the length of 
            // module.subtopics[index].questions.mcq.length, 
            // ...questions.true/false.length and ...questions.text.length
    
            console.log(`module created for "${module.module.title}" (q's = ${numOfQuestions}): `, moduleContent);
            console.log('---')
            console.log()

            const { data: moduleInserted, error: moduleInsertionError } = await supabase
            .from('modules')
            .insert({
                deck_id: deckId,
                title: module.module.title,
                description: module.module.description,
                content: moduleContent,
                // total_questions: int8
            })
            .select()
            .single()

            if (!moduleInserted || moduleInsertionError) {
                console.error('Failed inserting new module content into db: ', moduleInsertionError);
                return res.status(500).json({ message: "Failed inserting new module generated into db" })
            }

            completedModules++;
            await supabase
                .from('decks')
                .update({
                    completed_modules: completedModules
                })
                .eq('id', deckId)
                .eq('user_id', userId)

        } catch (error) {
            console.error(`Error generating module (${module.module.title}): `, error)
            return res.status(500).json({ message: 'Error generating module content' })
        }
    }

    // Count total questions

    // update status to complete
    await supabase
        .from('decks')
        .update({
            status: 'complete'
        })
        .eq('id', deckId)
        .eq('user_id', userId)
}

const createDeck = async (req, res) => {
    // TODO: handle validation with express-validator

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
        
        // update specific deck (:deckId) status to 'generating' 
        await supabase
            .from('decks')
            .update({
                status: 'generating',
                completed_modules: 0,
                total_modules: deck.preview_content.content.breakdown.length
            })
            .eq('id', deckId)
            .eq('user_id', userId);

        // run generation in background
        generateDeckContent(deck, userId).catch(error => {
            console.error('Background generation failed with error: ', error)
        })

        return res.status(200).json({
            message: `Started deck (id: ${deckId}) creation succesfully.`,
            deckId: deckId
        })
        
    } catch (error) {
        console.error('Error in starting deck creation at controller: ', error);
        res.status(500).json({ message: "Internal server error during deck creation start" })
    }
}

const getDeckCreationProgress = async (req, res) => {
    // Return status and modules completed from db
    const deckId = req.params.deckId;
    const userId = req.user.id;

    try {
        const { data: progress, error: contentGenerationError } = await supabase
            .from('decks')
            .select('status, completed_modules, total')
            .eq('user_id', userId)
            .eq('id', deckId)
            .single()

        if(!progress || contentGenerationError) {
            console.error(`Deck ${deckId} not found on db`)
            return res.status(404).json({
                message: `Deck ${deckId} not found on db`,
                error: contentGenerationError
            })
        }

        res.status(200).json({
            ok: true,
            status: progress.status,
            completedModules: progress.completed_modules,
            totalModules: progress.total_modules
        })
    } catch (error) {
        console.error(`Failed generating deck's (id: ${deckId}), with error: `, error);
        res.status(500).json({
            message: 'Internal error generating decks content',
            error: error
        })
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
    getDeckCreationProgress,
    getDecks,
    getDeckContent
}