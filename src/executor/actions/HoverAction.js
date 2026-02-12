import logger from '../../logger.js';

export default async function executeHover(page, params) {
    const { selector } = params;
    logger.info('Hovering', { selector });
    await page.hover(selector, { timeout: 5000 });
    return { hovered: selector };
}
