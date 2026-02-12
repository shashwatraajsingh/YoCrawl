import logger from '../../logger.js';

export default async function executeSelect(page, params) {
    const { selector, value } = params;
    logger.info('Selecting option', { selector, value });
    await page.selectOption(selector, value);
    return { selected: value, in: selector };
}
