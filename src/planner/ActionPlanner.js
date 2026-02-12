import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config.js';
import logger from '../logger.js';
import { SYSTEM_PROMPT, formatPageContext } from './prompts.js';

/**
 * Sends page context to Gemini and parses the JSON action response.
 */
export default class ActionPlanner {
    constructor() {
        this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: config.gemini.model,
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            },
            systemInstruction: SYSTEM_PROMPT,
        });
        this.chatSession = null;
    }

    /**
     * Injects the user's task as the first message and opens a chat session.
     */
    setTask(taskDescription) {
        const taskMessage = `## Task\n${taskDescription}\n\nComplete this task by controlling the browser. Start now.`;

        this.chatSession = this.model.startChat({
            history: [
                { role: 'user', parts: [{ text: taskMessage }] },
                {
                    role: 'model',
                    parts: [
                        {
                            text: JSON.stringify({
                                thinking: 'Understood. I will begin the task now.',
                                actions: [],
                                done: false,
                                result: null,
                            }),
                        },
                    ],
                },
            ],
        });
    }

    async planNextActions(pageContext, stepNumber, previousResults) {
        const userMessage = formatPageContext(
            pageContext,
            stepNumber,
            previousResults
        );

        logger.debug('Requesting Gemini plan', { step: stepNumber });

        const result = await this.chatSession.sendMessage(userMessage);
        const rawContent = result.response.text();

        logger.debug('Gemini response received', {
            chars: rawContent.length,
        });

        return this.parseResponse(rawContent);
    }

    parseResponse(rawContent) {
        try {
            const parsed = JSON.parse(rawContent);
            return {
                thinking: parsed.thinking || '',
                actions: parsed.actions || [],
                done: parsed.done === true,
                result: parsed.result || null,
            };
        } catch (error) {
            logger.error('Failed to parse Gemini response', {
                raw: rawContent.slice(0, 200),
            });
            throw new Error(`Invalid JSON from Gemini: ${error.message}`);
        }
    }

    /**
     * Gemini's chat session handles history internally,
     * but we can recreate it if it grows too large.
     */
    trimHistory() {
        // Gemini SDK manages chat history internally.
        // For very long sessions we could recreate the chat,
        // but for now the SDK handles it well within limits.
    }
}
