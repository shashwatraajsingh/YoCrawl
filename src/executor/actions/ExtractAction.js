import logger from '../../logger.js';

export default async function executeExtract(page, params) {
    const { selector, attribute } = params;
    logger.info('Extracting content', { selector, attribute });

    if (attribute) {
        const value = await page.getAttribute(selector, attribute);
        return { extracted: value };
    }

    const text = await page.textContent(selector);
    return { extracted: (text || '').trim() };
}
