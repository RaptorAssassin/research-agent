# Research Agent

An AI researching agent built with *LangChain.js* that researches the web and answers with sources.

[**Live Demo**]()

## How it Works

```mermaid
graph TD
    searchQuery[Search Query] --> apiCall["<code>POST /api/research</code><br><code>{query, stream: true, mode: 'sse'}</code>"]
    apiCall --> langgraph[LangGraph ]
    langgraph --> planning[Planning]
    planning --> research[Research]
    research --> webSearch[Web Search via Tavily]
    research --> webScrape[Page Scraping]
    webSearch --> sourceEvaluation[Source Evaluation]
    webScrape --> sourceEvaluation
    sourceEvaluation --> claimExtraction[Claim & Evidence Extraction]
    claimExtraction --> factCheck[Fact Check]
    factCheck --> synthesis[Synthesis]
    synthesis --> reportEvaluation[Report Evaluation]
    reportEvaluation --> followUp{Follow-Up Questions?}
    followUp -- Yes --> research
    followUp -- No --> render[Frontend Renders Response Markdown From Synthesis]
```

## Tech Stack

### Frontend

- **Next.js**
- **React**

### Backend

- **TypeScript**
- **LangChain.js & LangGraph**: A framework for building AI agents using nodes that fulfill different purposes like searching the web or fact-checking.
- **OpenAI-compatible API**: For LLM tasks, a OpenAI-compatible API endpoint specified in the .env file gets called. For this demo, Hackclub AI was used.

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

Copy the `.env.example` file and set an OpenAI-compatible API endpoint (base URL + API key) and the models you want to use. For the exact details, refer to the docs of the API you're using.

```bash
cp .env.example .env.local
```

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

View the app at [http://localhost:3000](http://localhost:3000/).

<!-- ## API

`POST /api/research` (or `GET /api/research?query=...`) accepts:

```json
{ "query": "string", "depth": "brief|standard|deep", "maxIterations": 2 }
```

- `depth` (default `standard`) controls answer length: `brief` gives a 2-3 sentence summary with 2-4 bullets and fewer searches; `deep` gives multi-paragraph explanations with up to 12 findings and more evidence per claim.
- Source scoring is deterministic (no LLM calls); the strong model is reserved for fact-checking, synthesis, and evaluation. -->

<!-- ## Frontend contract

Chat answers render the main response (`executiveSummary`) expanded, with `sources` inside a collapsed Sources dropdown. `findings`, evidence-backed `claims`, and `limitations` are produced by the backend but not rendered in the chat UI for now. -->

## Future Updates

Ollama support is in the works.