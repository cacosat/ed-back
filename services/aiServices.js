const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const generateDeckSyllabus = async (deckData) => {
    try {
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
            console.log('Assistant response: ', previewJson)


            // parse content and json
            try {
                preview = JSON.parse(previewJson);

                if (!preview.content) {
                    throw new Error('Preview data is missing required content field.');
                  }

                return {
                    preview, 
                    threadId: thread.id,
                }

            } catch (error) {
                // return preview and threadID
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

// const data = {
//     description: "Id like to learn about the finalist theory on criminal law, it's impact and importance in the criminal type, and the role of free will and accountability",
//     keyWords: 'Welzel; Criminal law;  German; Finalist theory vs; causalism; Volition in the commission of crimes'
// }
// const { preview, threadId } = generateDeckSyllabus(data)
// console.log('preview: ', preview)
// console.log('thread: ', threadId)


module.exports = {
    generateDeckSyllabus
}