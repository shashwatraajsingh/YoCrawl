import logger from '../../logger.js';

export default async function executeKeypress(page, params) {
    const { key } = params;
    logger.info('Pressing key', { key });
    await page.keyboard.press(key);
    return { pressed: key };
}
