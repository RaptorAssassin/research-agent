import { z } from "zod"
import type { Claim } from "../schemas/claim"
import type { ResearchState } from "../state"
import type { LLMProvider } from "@/lib/llm/provider"

export type FactCheckerDeps = {
  llm: LLMProvider
}

const FactCheckSchema = z.object({
  status: z.enum(["supported", "weakly_supported", "unsupported", "conflicting", "unresolved"]),
  reasoning: z.string().min(1).describe("1-2 sentences why"),
})

export function createFactCheckerNode(deps: FactCheckerDeps) {
  return async (state: typeof ResearchState.State): Promise<{ claims: Claim[] }> => {
    if (state.claims.length === 0) return { claims: [] }

    const evidenceById = new Map(state.evidence.map((e) => [e.evidenceId, e]))
    const sourceById = new Map(state.sources.map((s) => [s.sourceId, s]))

    const updated: Claim[] = []

    for (const claim of state.claims) {
      const evTexts = claim.evidenceIds
        .map((id) => evidenceById.get(id))
        .filter(Boolean)
        .map((e) => `Evidence (${e!.sourceId} ${sourceById.get(e!.sourceId)?.title ?? ""}): "${e!.text}"`)
        .join("\n")

      if (!evTexts) {
        updated.push({ ...claim, status: "unresolved" })
        continue
      }

      try {
        const out = await deps.llm.structuredGenerate(
          `Fact-check ONE claim against its evidence. Claim: "${claim.statement}"\nEvidence:\n${evTexts}\n\nStatuses: supported=fully backed by verbatim evidence, weakly_supported=partial/indirect, unsupported=contradicted or not in evidence, conflicting=evidence contradicts itself, unresolved=insufficient evidence. Respond ONLY JSON {status, reasoning}.`,
          FactCheckSchema,
        )
        updated.push({ ...claim, status: out.status })
      } catch {
        const hasText = claim.evidenceIds.some((id) => {
          const t = evidenceById.get(id)?.text.toLowerCase() ?? ""
          return claim.statement.toLowerCase().split(/\s+/).some((tok) => tok.length > 4 && t.includes(tok))
        })
        updated.push({ ...claim, status: hasText ? "weakly_supported" : "unresolved" })
      }
    }

    return { claims: updated }
  }
}
