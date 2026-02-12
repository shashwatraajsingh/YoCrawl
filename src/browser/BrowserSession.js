import { chromium } from 'playwright';
import config from '../config.js';
import logger from '../logger.js';

/**
 * Manages the Playwright browser lifecycle.
 * One browser, one context, one active page at a time.
 *
 * Inspired by surf.new's Steel session management —
 * clean create/release pattern with configurable viewport dimensions.
 */
export default class BrowserSession {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.launchedAt = null;
    }

    async launch() {
        logger.info('Launching browser', {
            headless: config.browser.headless,
            viewport: config.browser.viewport,
        });

        this.browser = await chromium.launch({
            headless: config.browser.headless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
            ],
        });

        this.context = await this.browser.newContext({
            viewport: config.browser.viewport,
            userAgent:
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            // Be a bit more browser-like to avoid bot detection
            locale: 'en-US',
            timezoneId: 'America/New_York',
        });

        this.page = await this.context.newPage();
        this.launchedAt = Date.now();

        // Set default navigation timeout from config
        this.page.setDefaultNavigationTimeout(config.browser.timeout);
        this.page.setDefaultTimeout(config.browser.timeout);

        logger.info('Browser ready');
        return this.page;
    }

    async close() {
        if (this.browser) {
            const uptime = this.launchedAt
                ? `${((Date.now() - this.launchedAt) / 1000).toFixed(1)}s`
                : 'unknown';

            await this.browser.close().catch((err) => {
                logger.warn('Browser close error (non-critical)', {
                    error: err.message,
                });
            });

            this.browser = null;
            this.context = null;
            this.page = null;
            this.launchedAt = null;
            logger.info('Browser closed', { uptime });
        }
    }

    isActive() {
        return this.browser !== null && this.page !== null;
    }

    /**
     * Returns how long the session has been alive, in seconds.
     */
    getUptimeSeconds() {
        if (!this.launchedAt) return 0;
        return (Date.now() - this.launchedAt) / 1000;
    }
}
