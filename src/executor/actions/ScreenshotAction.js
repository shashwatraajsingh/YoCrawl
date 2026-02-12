import { mkdir } from 'fs/promises';
import { join } from 'path';
import config from '../../config.js';
import logger from '../../logger.js';

export default async function executeScreenshot(page, params) {
    const { name = `screenshot-${Date.now()}`, fullPage = false } = params;

    await mkdir(config.screenshots.directory, { recursive: true });

    const filePath = join(config.screenshots.directory, `${name}.png`);
    await page.screenshot({ path: filePath, fullPage });

    logger.info('Screenshot saved', { filePath });
    return { screenshotPath: filePath };
}
