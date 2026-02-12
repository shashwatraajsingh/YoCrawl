import executeNavigate from './actions/NavigateAction.js';
import executeClick from './actions/ClickAction.js';
import executeType from './actions/TypeAction.js';
import executeScroll from './actions/ScrollAction.js';
import executeWait from './actions/WaitAction.js';
import executeScreenshot from './actions/ScreenshotAction.js';
import executeExtract from './actions/ExtractAction.js';
import executeSelect from './actions/SelectAction.js';
import executeKeypress from './actions/KeypressAction.js';
import executeHover from './actions/HoverAction.js';
import logger from '../logger.js';

const ACTION_HANDLERS = {
    navigate: executeNavigate,
    click: executeClick,
    type: executeType,
    scroll: executeScroll,
    wait: executeWait,
    screenshot: executeScreenshot,
    extract: executeExtract,
    select: executeSelect,
    keypress: executeKeypress,
    hover: executeHover,
};

/**
 * Routes JSON action objects to their corresponding handler functions.
 * Each action must have { action: string, ...params }.
 */
export default class ActionExecutor {
    constructor(page) {
        this.page = page;
    }

    async execute(actionObject) {
        const { action, ...params } = actionObject;

        try {
            const handler = ACTION_HANDLERS[action];
            if (!handler) {
                const supported = Object.keys(ACTION_HANDLERS).join(', ');
                throw new Error(`Unknown action "${action}". Supported: ${supported}`);
            }

            const result = await handler(this.page, params);
            return { success: true, action, result };
        } catch (error) {
            logger.error('Action failed', { action, error: error.message });
            return { success: false, action, error: error.message };
        }
    }

    /**
     * Executes a batch of actions sequentially.
     * Returns results for every action, even if one fails.
     */
    async executeBatch(actions) {
        const results = [];

        for (const actionObject of actions) {
            const result = await this.execute(actionObject);
            results.push(result);

            if (!result.success) {
                logger.warn('Stopping batch — action failed', {
                    action: actionObject.action,
                });
                break;
            }
        }

        return results;
    }

    static listSupportedActions() {
        return Object.keys(ACTION_HANDLERS);
    }
}
