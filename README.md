# YoCrawl — AI Browser Agent

An autonomous browser agent powered by Playwright and an LLM, featuring a clean Next.js dashboard.

![Frontend Dashboard](https://placehold.co/1200x600/f8fafc/3b82f6?text=YoCrawl+Dashboard)

## Architecture

- **Backend (Node.js)**: Express API + Socket.IO + Agent Executor (Playwright).
- **Frontend (Next.js)**: Dashboard for starting tasks and viewing real-time logs/screenshots.

```
┌─────────────┐       REST / Socket.IO       ┌──────────────┐
│  Frontend   │ ◄──────────────────────────► │   Backend    │
│ (Next.js)   │                              │  (Node.js)   │
└─────────────┘                              └──────────────┘
   Port 3000                                    Port 4000
                                                    │
                                                    ▼
                                             ┌──────────────┐
                                             │  Playwright  │
                                             │   Browser    │
                                             └──────────────┘
```

## Quick Start

### 1. Backend Setup

```bash
# Install dependencies
npm install
npx playwright install chromium

# Configure environment
cp .env.example .env
# Edit .env: Add GEMINI_API_KEY
# Ensure PORT=4000
```

Start the backend:

```bash
npm start
# Server running on http://localhost:4000
```

### 2. Frontend Setup

In a new terminal:

```bash
cd frontend
npm install
npm run dev
# Dashboard running on http://localhost:3000
```

### 3. Use the Agent

Open [http://localhost:3000](http://localhost:3000).
Enter a task (e.g., "Go to news.ycombinator.com and find the top AI story") and click Start.

## Project Structure

```
.
├── src/                    # Backend Source
│   ├── api/                # Express & Socket.IO
│   ├── agent/              # Agent Logic (Observe-Plan-Act)
│   ├── executor/           # Playwright Action Handlers
│   └── ...
├── frontend/               # Next.js Frontend
│   ├── src/app/            # App Router Pages
│   ├── src/components/     # UI Components
│   └── ...
├── cli.js                  # Standalone CLI Tool
└── ...
```

## API & CLI

You can also run the agent without the frontend:

```bash
# REST API
curl -X POST http://localhost:4000/api/agent/start \
  -H "Content-Type: application/json" \
  -d '{"task": "Check prices on amazon", "startUrl": "https://amazon.com"}'

# CLI
node cli.js "Search Google for Playwright" "https://google.com"
```

## Development

- **Backend Logs**: `logs/agent.log`
- **Screenshots**: `screenshots/` (served at `http://localhost:4000/screenshots/`)

## Tests

```bash
npm test
```
