# Research Agent

An AI researching agent built with *LangChain.js* that researches the web and answers with sources.

[**Live Demo**](https://karl.hackclub.app/)

<img width="1291" height="927" alt="image" src="https://github.com/user-attachments/assets/9a5e5149-8451-41d7-9d70-0b0b8d22c158" />

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

## Future Updates

Ollama support is in the works.
