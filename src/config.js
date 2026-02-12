import 'dotenv/config';

const config = {
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.1,
        maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS, 10) || 8192,
    },
    browser: {
        headless: process.env.BROWSER_HEADLESS === 'true',
        viewport: {
            width: parseInt(process.env.BROWSER_WIDTH, 10) || 1280,
            height: parseInt(process.env.BROWSER_HEIGHT, 10) || 720,
        },
        timeout: parseInt(process.env.BROWSER_TIMEOUT, 10) || 15_000,
    },
    agent: {
        maxSteps: parseInt(process.env.MAX_AGENT_STEPS, 10) || 25,
        stepDelayMs: parseInt(process.env.AGENT_STEP_DELAY_MS, 10) || 500,
        sessionTimeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES, 10) || 15,
    },
    screenshots: {
        directory: process.env.SCREENSHOT_DIR || './screenshots',
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
    },
    api: {
        port: parseInt(process.env.PORT, 10) || 4000,
        corsOrigin: process.env.CORS_ORIGIN || '*',
    },
};

export default config;
