# Research Agent

An AI researching agent built with *LangChain.js* that researches the web and answers with sources.


## How it Works

1. Enter a query: Search for anything you would like to know, for example *""*

## Tech Stack

### Frontend

- **Next.js**
- **React**

### Backend

- **TypeScript**
- **LangChain.js & LangGraph**: A framework for building AI agents using nodes that fulfill different purposes like searching the web or fact-checking.

## Getting Started

Clone this repository:

```bash
git clone https://github.com/RaptorAssassin/research-agent.git
cd research-agent
```

Make sure you got *Node.js* and *pnpm* installed:

```bash
node -v #v24.0.0 or higher
pnpm -v #v11.25.0 or higher
```

Copy the `.env.example` file and set an OpenAI-compatible endpoint

```bash
cp .env.example .env.local
```

Example .env.local file:

```sh
OPENAI_COMPATIBLE_API_URL=https://openrouter.ai/api/v1
OPENAI_COMPATIBLE_API_KEY=sk-...
OPENAI_COMPATIBLE_CHEAP_MODEL=openai/gpt-4o-mini
OPENAI_COMPATIBLE_STRONG_MODEL=openai/gpt-4o
```



Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

View the app at [http://localhost:3000](http://localhost:3000/)

## API

`POST /api/research` (or `GET /api/research?query=...`) accepts:

```json
{ "query": "string", "depth": "brief|standard|deep", "maxIterations": 2 }
```

- `depth` (default `standard`) controls answer length: `brief` gives a 2-3 sentence summary with 2-4 bullets and fewer searches; `deep` gives multi-paragraph explanations with up to 12 findings and more evidence per claim.
- Source scoring is deterministic (no LLM calls); the strong model is reserved for fact-checking, synthesis, and evaluation.

## Frontend contract

Chat answers render the main response (`executiveSummary`) expanded, with `sources` inside a collapsed Sources dropdown. `findings`, evidence-backed `claims`, and `limitations` are produced by the backend but not rendered in the chat UI for now.

## Future

Local Ollama support (`lib/llm/ollama.ts`) is kept in the repo but currently unwired — the app only uses the OpenAI-compatible API for now.
