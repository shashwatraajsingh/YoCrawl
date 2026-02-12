import logger from '../../logger.js';

export default async function executeClick(page, params) {
    const { selector } = params;
    logger.info('Clicking', { selector });
    await page.click(selector, { timeout: 5000 });
    await page.waitForLoadState('domcontentloaded').catch(() => { });
    return { clicked: selector };
}
