import AgentLoop from './src/agent/AgentLoop.js';
import logger from './src/logger.js';

const task = process.argv[2];
const startUrl = process.argv[3] || 'https://www.google.com';

if (!task) {
    console.log('Usage: node cli.js "<task description>" [start-url]');
    console.log('');
    console.log('Examples:');
    console.log('  node cli.js "Search Google for Playwright docs"');
    console.log(
        '  node cli.js "Find the price of iPhone 16" "https://www.apple.com"'
    );
    process.exit(1);
}

async function main() {
    const agent = new AgentLoop();

    try {
        const report = await agent.run(task, startUrl);
        logger.info('Final report', report);
        console.log('\n━━━ Agent Report ━━━');
        console.log(JSON.stringify(report, null, 2));
    } catch (error) {
        logger.error('Agent crashed', {
            error: error.message,
            stack: error.stack,
        });
        process.exit(1);
    }
}

main();
