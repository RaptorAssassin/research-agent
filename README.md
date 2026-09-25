# Research Agent

An AI researching agent built with *LangChain.js* that researches the web and answers with sources.


## Tech Stack

- **LangChain.js**: A framework that uses LangGraph for building AI agents using nodes that fulfill different purposes like searching the web or fact-checking.




## Getting Started

### Install Dependencies

```bash
pnpm install
```

### Run the Development Server

```bash
pnpm dev
```

### Copy the `.env.example` file and set a Ollama model

```bash
cp .env.example .env.local
```

Example .env.local file:

```env
OLLAMA_MODEL=gemma4:12b
```

### Run Ollama

```bash
ollama serve
```

