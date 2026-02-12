import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import ActionExecutor from '../src/executor/ActionExecutor.js';

describe('ActionExecutor', () => {
    it('lists all supported actions', () => {
        const actions = ActionExecutor.listSupportedActions();
        assert.ok(actions.includes('navigate'));
        assert.ok(actions.includes('click'));
        assert.ok(actions.includes('type'));
        assert.ok(actions.includes('scroll'));
        assert.ok(actions.includes('wait'));
        assert.ok(actions.includes('screenshot'));
        assert.ok(actions.includes('extract'));
        assert.ok(actions.includes('select'));
        assert.ok(actions.includes('keypress'));
        assert.ok(actions.includes('hover'));
    });

    it('rejects unknown actions with a clear error', async () => {
        const mockPage = {};
        const executor = new ActionExecutor(mockPage);

        const result = await executor.execute({ action: 'dance' });
        assert.equal(result.success, false);
        assert.ok(result.error.includes('Unknown action'));
        assert.ok(result.error.includes('dance'));
    });

    it('executes a navigate action against a mock page', async () => {
        const mockPage = {
            goto: mock.fn(async () => { }),
            url: mock.fn(() => 'https://example.com'),
        };

        const executor = new ActionExecutor(mockPage);
        const result = await executor.execute({
            action: 'navigate',
            url: 'https://example.com',
        });

        assert.equal(result.success, true);
        assert.equal(result.action, 'navigate');
    });

    it('stops batch execution on first failure', async () => {
        const mockPage = {
            goto: mock.fn(async () => { }),
            url: mock.fn(() => 'https://example.com'),
            click: mock.fn(async () => {
                throw new Error('Element not found');
            }),
        };

        const executor = new ActionExecutor(mockPage);
        const results = await executor.executeBatch([
            { action: 'navigate', url: 'https://example.com' },
            { action: 'click', selector: '#missing' },
            { action: 'click', selector: '#never-reached' },
        ]);

        assert.equal(results.length, 2);
        assert.equal(results[0].success, true);
        assert.equal(results[1].success, false);
    });
});
