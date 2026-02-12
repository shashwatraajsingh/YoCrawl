import 'dotenv/config';

const config = {
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },
    browser: {
        headless: process.env.BROWSER_HEADLESS === 'true',
    },
    agent: {
        maxSteps: parseInt(process.env.MAX_AGENT_STEPS, 10) || 25,
    },
    screenshots: {
        directory: process.env.SCREENSHOT_DIR || './screenshots',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
    api: {
        port: parseInt(process.env.PORT, 10) || 3000,
        corsOrigin: process.env.CORS_ORIGIN || '*',
    },
};

export default config;
