const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
const { threadId } = require('worker_threads');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const generateDeckSyllabus = async (deckData) => {
    try {
        if (!deckData) { // || !deckData.description || !deckData.keywords
            throw new Error('Invalid deckData. Missing required fields.');
        }

        const syllabusAssistant = process.env.SYLLABUS_ASSISTANT_ID;

        // prompt construction
        const syllabusTemplate = await fs.readFile(path.join(__dirname, '../prompts/syllabus_template.md'), 'utf-8');
        const prompt = syllabusTemplate
            .replace('{{description}}', deckData.description)
            .replace('{{keywords}}', deckData.keywords.join(', ')); // keywords joined into a str form an array

        // create new thread
        const thread = await openai.beta.threads.create();

        // add message to thread
        const message = await openai.beta.threads.messages.create(
            thread.id,
            {
                role: 'user',
                content: prompt,
            }
        )

        // run assistant on thread w/out streaming and with polling (to monitor `status`)
        const run = await openai.beta.threads.runs.createAndPoll(
            thread.id, 
            {
                assistant_id: syllabusAssistant
            }
        )

        // get assistant response (last msg in thread)
        let preview;
        if (run.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(
                run.thread_id
            )
            
            // Find the assistant's message
            const assistantMessages = messages.data.filter((msg) => msg.role === 'assistant');
            if (assistantMessages.length === 0) {
                throw new Error('Assistant did not generate a response.');
            }

            const assistantMessage = assistantMessages[assistantMessages.length - 1];
            const previewJson = assistantMessage.content[0].text.value;


            // parse content and json
            try {
                preview = JSON.parse(previewJson);

                if (!preview.content) {
                    throw new Error('Preview data is missing required content field.');
                  }

                // return preview and threadID
                return {
                    preview, 
                    threadId: thread.id,
                }

            } catch (error) {
                console.error('Error parsing assistant response: ', error);
                console.error('Assistant response content:', previewJson);
                throw new Error('Assistant response couldnt be parsed to json');
            }

        } else {
            console.log('Run still not completed');
            throw new Error('Assistant run did not complete.');
        }

    } catch (error) {
        console.error('Error creating Deck Preview with OAI: ', error);
        throw new Error('Failed in generating Deck Syllabus/Preview with OAI')
    }
}

const generateDeckModuleContent = async (deckData, module, thread) => {
    // generate deck content per module
    try {
        if (!module || !thread || !deckData) {
            console.error(`Missing required fields, module and/or thread is missing. Thread: ${thread}; Module: ${module}`)
            throw new Error('Missing required fields, either module and/or thread.')
        }

        const deckAssistant = process.env.DECK_ASSISTANT_ID;

        // prompt construction
        const deckPrompt = await fs.readFile(path.join(__dirname, '../prompts/deck_template.md'), 'utf-8');
        const prompt = deckPrompt
            .replace('{{description}}', deckData.creation_data.description)
            .replace('{{keywords}}', deckData.creation_data.keywords.join(', '))
            .replace('{{syllabus}}', JSON.stringify(deckData.preview_content))
            .replace('{{specific_module_json}}', JSON.stringify(module))

        // add message to thread
        const message = await openai.beta.threads.messages.create(
            thread, 
            {
                role: 'user',
                content: prompt
            }
        )

        console.log()
        console.log(`Message added to thread ${thread}: `, message)
        console.log()

        // run assistant on thread
        const run = await openai.beta.threads.runs.createAndPoll(
            thread,
            {
                assistant_id: deckAssistant
            }
        )

        let content;
        if (run.status === 'completed') {
            // get assistant response if run.status==='completed', lst msg in thread
            const messages = await openai.beta.threads.messages.list(run.thread_id);
            const assistantMessages = messages.data.filter((msg) => msg.role === 'assistant');
            if (assistantMessages.length === 0) {
                throw new Error('Response received from the assistant without contents')
            }
            
            for (let i = 1; i < assistantMessages.length; i++) {
                console.log(`Iterating assisstant message list at index ${i}/${assistantMessages.length}`)
                console.log(`content title: `, assistantMessages[i].content[0].text.value.module)
                console.log()
            }

            const response = assistantMessages[assistantMessages.length - 1];
            console.log()
            console.log(`assistant msgs list of length ${assistantMessages.length}: `, assistantMessages)
            console.log()
            console.log(`Response retrieved as last msg of assistant messages at index ${assistantMessages.length - 1}: `, response.content[0].text.value)
            console.log()
            console.log(`last message from msg list: `, assistantMessages.slice(-1)[0].content[0].text.value)
            console.log()
            const responseContent = response.content[0].text.value;

            try {
                // parse resulting content and json
                const responseJson = JSON.parse(responseContent);

                // return final content and thread id
                return responseJson;

            } catch (error) {
                console.error('Error parsing assistant response: ', error);
                console.error('Assistant response content:', responseContent);
                throw new Error('Assistant response couldnt be parsed to json');
            }    

        } else {
            console.error("Couldn't retrieve content, AI run isn't complete: run is ", run.status)
            throw new Error("AI run isn't complete")
        }

        
    } catch (error) {
        console.error('Error generating full deck content with OAI: ', error);
        throw new Error("Failed generating ful deck content with OAI")
    }
}

module.exports = {
    generateDeckSyllabus,
    generateDeckModuleContent
}