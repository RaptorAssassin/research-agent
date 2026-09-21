import { ResearchPlanSchema, type ResearchPlan } from "../schemas/plan"
import type { ResearchState } from "../state"
import type { LLMProvider } from "@/lib/llm/provider"

export type PlannerDeps = {
  llm: LLMProvider
}

export function createPlannerNode(deps: PlannerDeps) {
  const { llm } = deps

  return async (state: typeof ResearchState.State): Promise<{ plan: ResearchPlan }> => {
    const query = state.query.trim()
    if (!query) {
      return {
        plan: {
          objective: "No query provided",
          subtasks: ["Clarify research objective"],
        },
      }
    }

    try {
      const plan = await llm.structuredGenerate(
        `Create a research plan for query: "${query}". Objective should restate the query concisely. Subtasks should be 3-5 concrete search topics (each 4-10 words) covering different angles. Respond ONLY with JSON.`,
        ResearchPlanSchema,
      )
      const subtasks = plan.subtasks.slice(0, 5)
      if (subtasks.length < 1) throw new Error("Empty subtasks")
      return { plan: { objective: plan.objective, subtasks } }
    } catch {
      return {
        plan: {
          objective: query,
          subtasks: [`Research objective: ${query}`, `Key facts about: ${query}`, `Recent developments: ${query}`],
        },
      }
    }
  }
}
