import ActionExecutor from '../executor/ActionExecutor.js';

const SUPPORTED_ACTIONS = ActionExecutor.listSupportedActions();

const SYSTEM_PROMPT = `You are a browser automation agent. You control a real browser through JSON actions.

## Your Capabilities
You can perform these actions:
${SUPPORTED_ACTIONS.map((a) => `- "${a}"`).join('\n')}

## Action Format
Respond with a JSON object containing:
- "thinking": Brief reasoning about what you see and what to do next (string).
- "actions": An array of action objects to execute sequentially.
- "done": Boolean. Set to true when the original task is complete.
- "result": When done is true, provide the final answer or summary here.

## Action Schemas
- { "action": "navigate", "url": "https://..." }
- { "action": "click", "selector": "css-selector" }
- { "action": "type", "selector": "css-selector", "text": "...", "clearFirst": true }
- { "action": "scroll", "direction": "down"|"up", "amount": 500 }
- { "action": "wait", "milliseconds": 1000 }
- { "action": "wait", "forSelector": "css-selector", "milliseconds": 5000 }
- { "action": "screenshot", "name": "descriptive-name", "fullPage": false }
- { "action": "extract", "selector": "css-selector", "attribute": "href" }
- { "action": "select", "selector": "css-selector", "value": "option-value" }
- { "action": "keypress", "key": "Enter" }
- { "action": "hover", "selector": "css-selector" }

## Rules
1. ALWAYS respond with valid JSON. No markdown, no backticks, just raw JSON.
2. Use the provided CSS selectors from the page context when possible.
3. Execute the minimum number of actions needed per step.
4. If an action fails, analyze the error and try a different approach.
5. When a task is complete, set "done": true and summarize the result.
6. If you are stuck after 3 attempts, set "done": true and explain what went wrong.`;

/**
 * Formats page context into a user message for the LLM.
 */
function formatPageContext(pageContext, stepNumber, previousResults) {
    const parts = [
        `## Current Page (Step ${stepNumber})`,
        `**URL:** ${pageContext.url}`,
        `**Title:** ${pageContext.title}`,
        '',
        '### Interactive Elements',
        formatElements(pageContext.interactiveElements),
        '',
        '### Visible Text (truncated)',
        pageContext.visibleText.slice(0, 2000),
    ];

    if (previousResults && previousResults.length > 0) {
        parts.unshift(
            '## Previous Action Results',
            JSON.stringify(previousResults, null, 2),
            ''
        );
    }

    return parts.join('\n');
}

function formatElements(elements) {
    if (elements.length === 0) return '_No interactive elements found._';

    return elements
        .map((el, index) => {
            const parts = [`[${index}] <${el.tag}>`];
            if (el.text) parts.push(`text="${el.text}"`);
            if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
            if (el.href) parts.push(`href="${el.href}"`);
            if (el.ariaLabel) parts.push(`aria="${el.ariaLabel}"`);
            parts.push(`selector="${el.selector}"`);
            return parts.join(' | ');
        })
        .join('\n');
}

export { SYSTEM_PROMPT, formatPageContext };
