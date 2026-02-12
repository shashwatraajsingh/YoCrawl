import logger from '../../logger.js';

export default async function executeWait(page, params) {
    const { milliseconds = 1000, forSelector } = params;

    if (forSelector) {
        logger.info('Waiting for element', { selector: forSelector });
        await page.waitForSelector(forSelector, { timeout: milliseconds });
        return { waitedFor: forSelector };
    }

    logger.info('Waiting', { milliseconds });
    await page.waitForTimeout(milliseconds);
    return { waited: milliseconds };
}
