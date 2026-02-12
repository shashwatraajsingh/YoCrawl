import logger from '../logger.js';

/**
 * Extracts a structured snapshot of the current page state
 * that gets sent to the LLM for decision-making.
 */
export default class PageContextExtractor {
    constructor(page) {
        this.page = page;
    }

    async extract() {
        const url = this.page.url();
        const title = await this.page.title();
        const interactiveElements = await this.extractInteractiveElements();
        const visibleText = await this.extractVisibleText();

        logger.debug('Page context extracted', {
            url,
            elementCount: interactiveElements.length,
        });

        return { url, title, interactiveElements, visibleText };
    }

    /**
     * Finds all clickable / typeable / selectable elements and returns
     * a compact representation the LLM can reason about.
     */
    async extractInteractiveElements() {
        return this.page.evaluate(() => {
            const selectors = [
                'a[href]',
                'button',
                'input',
                'textarea',
                'select',
                '[role="button"]',
                '[role="link"]',
                '[role="tab"]',
                '[onclick]',
            ];

            const seen = new Set();
            const elements = [];

            for (const selector of selectors) {
                for (const el of document.querySelectorAll(selector)) {
                    if (seen.has(el)) continue;
                    seen.add(el);

                    const rect = el.getBoundingClientRect();
                    const isVisible =
                        rect.width > 0 &&
                        rect.height > 0 &&
                        window.getComputedStyle(el).visibility !== 'hidden';

                    if (!isVisible) continue;

                    elements.push({
                        tag: el.tagName.toLowerCase(),
                        type: el.getAttribute('type') || undefined,
                        id: el.id || undefined,
                        name: el.getAttribute('name') || undefined,
                        text: (el.innerText || el.value || '').trim().slice(0, 80),
                        placeholder: el.getAttribute('placeholder') || undefined,
                        href: el.getAttribute('href') || undefined,
                        ariaLabel: el.getAttribute('aria-label') || undefined,
                        selector: buildSelector(el),
                    });
                }
            }

            return elements;

            function buildSelector(el) {
                if (el.id) return `#${el.id}`;
                if (el.getAttribute('name'))
                    return `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
                if (el.getAttribute('aria-label'))
                    return `[aria-label="${el.getAttribute('aria-label')}"]`;

                // Fallback: nth-of-type path
                const parts = [];
                let current = el;
                while (current && current !== document.body) {
                    const parent = current.parentElement;
                    if (!parent) break;
                    const siblings = [...parent.children].filter(
                        (c) => c.tagName === current.tagName
                    );
                    const index = siblings.indexOf(current) + 1;
                    parts.unshift(
                        `${current.tagName.toLowerCase()}:nth-of-type(${index})`
                    );
                    current = parent;
                }
                return parts.join(' > ');
            }
        });
    }

    /**
     * Returns the first ~3000 chars of visible body text.
     * This gives the LLM enough context without blowing up the token budget.
     */
    async extractVisibleText() {
        const rawText = await this.page.evaluate(() => {
            return document.body?.innerText || '';
        });
        return rawText.replace(/\s+/g, ' ').trim().slice(0, 3000);
    }
}
