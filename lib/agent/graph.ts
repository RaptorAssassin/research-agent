import { StateGraph, START, END } from "@langchain/langgraph"
import { ResearchState } from "./state"
import { OllamaProvider } from "@/lib/llm/ollama"
import type { LLMProvider } from "@/lib/llm/provider"
import { TavilySearchProvider } from "@/lib/tools/tavily"
import { SimpleScrapeProvider } from "@/lib/tools/scrape"
import { createPlannerNode } from "./nodes/planner"
import { createResearcherNode } from "./nodes/researcher"
import { createSourceEvaluatorNode } from "./nodes/sourceEvaluator"
import { createExtractorNode } from "./nodes/extractor"
import { createFactCheckerNode } from "./nodes/factChecker"
import { createSynthesizerNode } from "./nodes/synthesizer"
import { createEvaluatorNode } from "./nodes/evaluator"
import type { SearchProvider } from "@/lib/tools/search"
import type { ScrapeProvider } from "@/lib/tools/scrape"

export const MAX_ITERATIONS = 2

export type GraphDeps = {
  cheapLLM?: LLMProvider
  strongLLM?: LLMProvider
  searchProvider?: SearchProvider
  scrapeProvider?: ScrapeProvider
  maxIterations?: number
}

function defaultCheapLLM(): LLMProvider {
  return new OllamaProvider({
    model: process.env.OLLAMA_CHEAP_MODEL ?? process.env.OLLAMA_MODEL ?? "gemma3:12b",
    temperature: 0.3,
  })
}

function defaultStrongLLM(): LLMProvider {
  return new OllamaProvider({
    model: process.env.OLLAMA_STRONG_MODEL ?? process.env.OLLAMA_MODEL ?? "gemma3:12b",
    temperature: 0.2,
  })
}

export function buildGraph(deps: GraphDeps = {}) {
  const cheapLLM = deps.cheapLLM ?? defaultCheapLLM()
  const strongLLM = deps.strongLLM ?? defaultStrongLLM()
  const searchProvider = deps.searchProvider ?? new TavilySearchProvider()
  const scrapeProvider = deps.scrapeProvider ?? new SimpleScrapeProvider()
  const maxIterations = deps.maxIterations ?? MAX_ITERATIONS

  const plannerNode = createPlannerNode({ llm: cheapLLM })
  const researcherNode = createResearcherNode({ searchProvider, scrapeProvider })
  const sourceEvaluatorNode = createSourceEvaluatorNode({ llm: cheapLLM })
  const extractorNode = createExtractorNode({ llm: cheapLLM })
  const factCheckerNode = createFactCheckerNode({ llm: strongLLM })
  const synthesizerNode = createSynthesizerNode({ llm: strongLLM })
  const evaluatorNode = createEvaluatorNode({ llm: strongLLM, maxIterations })

  const graph = new StateGraph(ResearchState)
    .addNode("planner", plannerNode)
    .addNode("researcher", researcherNode)
    .addNode("sourceEvaluator", sourceEvaluatorNode)
    .addNode("extractor", extractorNode)
    .addNode("factChecker", factCheckerNode)
    .addNode("synthesizer", synthesizerNode)
    .addNode("evaluator", evaluatorNode)
    .addEdge(START, "planner")
    .addEdge("planner", "researcher")
    .addEdge("researcher", "sourceEvaluator")
    .addEdge("sourceEvaluator", "extractor")
    .addEdge("extractor", "factChecker")
    .addEdge("factChecker", "synthesizer")
    .addEdge("synthesizer", "evaluator")
    .addConditionalEdges("evaluator", (state) => {
      if (state.evaluation?.needsMoreResearch && state.iteration < maxIterations) {
        return "researcher"
      }
      return END
    })
    .compile()

  return graph
}

export const graph = buildGraph()

export type { ResearchState }
