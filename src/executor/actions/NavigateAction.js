import logger from '../../logger.js';

export default async function executeNavigate(page, params) {
    const { url } = params;
    logger.info('Navigating', { url });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    return { navigatedTo: page.url() };
}
