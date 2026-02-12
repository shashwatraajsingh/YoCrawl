import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_PROMPT, formatPageContext } from '../src/planner/prompts.js';

describe('Prompts', () => {
    it('system prompt includes all action types', () => {
        const requiredActions = [
            'navigate',
            'click',
            'type',
            'scroll',
            'wait',
            'screenshot',
            'extract',
            'select',
            'keypress',
            'hover',
        ];

        for (const action of requiredActions) {
            assert.ok(
                SYSTEM_PROMPT.includes(`"${action}"`),
                `System prompt missing action: ${action}`
            );
        }
    });

    it('formats page context with URL and title', () => {
        const context = {
            url: 'https://test.com',
            title: 'Test Page',
            interactiveElements: [],
            visibleText: 'Hello world',
        };

        const formatted = formatPageContext(context, 1, null);
        assert.ok(formatted.includes('https://test.com'));
        assert.ok(formatted.includes('Test Page'));
        assert.ok(formatted.includes('Hello world'));
        assert.ok(formatted.includes('Step 1'));
    });

    it('includes previous results when provided', () => {
        const context = {
            url: 'https://test.com',
            title: 'Test',
            interactiveElements: [],
            visibleText: '',
        };

        const previousResults = [{ success: true, action: 'click' }];
        const formatted = formatPageContext(context, 2, previousResults);
        assert.ok(formatted.includes('Previous Action Results'));
    });

    it('formats interactive elements with selectors', () => {
        const context = {
            url: 'https://test.com',
            title: 'Test',
            interactiveElements: [
                {
                    tag: 'button',
                    text: 'Submit',
                    selector: '#submit-btn',
                },
            ],
            visibleText: '',
        };

        const formatted = formatPageContext(context, 1, null);
        assert.ok(formatted.includes('<button>'));
        assert.ok(formatted.includes('Submit'));
        assert.ok(formatted.includes('#submit-btn'));
    });
});
