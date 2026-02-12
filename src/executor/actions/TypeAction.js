import logger from '../../logger.js';

export default async function executeType(page, params) {
    const { selector, text, clearFirst = true } = params;
    logger.info('Typing', { selector, textLength: text.length });

    if (clearFirst) {
        await page.click(selector, { clickCount: 3 });
    }

    await page.fill(selector, text);
    return { typed: text.length, into: selector };
}
