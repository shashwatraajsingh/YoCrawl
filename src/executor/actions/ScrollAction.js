import logger from '../../logger.js';

export default async function executeScroll(page, params) {
    const { direction = 'down', amount = 500 } = params;
    const delta = direction === 'up' ? -amount : amount;
    logger.info('Scrolling', { direction, amount });
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(300);
    return { scrolled: direction, pixels: amount };
}
