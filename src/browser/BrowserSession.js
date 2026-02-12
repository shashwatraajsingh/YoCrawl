import { chromium } from 'playwright';
import config from '../config.js';
import logger from '../logger.js';

/**
 * Manages the Playwright browser lifecycle.
 * One browser, one context, one active page at a time.
 */
export default class BrowserSession {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async launch() {
        logger.info('Launching browser', { headless: config.browser.headless });

        this.browser = await chromium.launch({
            headless: config.browser.headless,
        });

        this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 },
            userAgent:
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        this.page = await this.context.newPage();
        logger.info('Browser ready');
        return this.page;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
            logger.info('Browser closed');
        }
    }

    isActive() {
        return this.browser !== null && this.page !== null;
    }
}
