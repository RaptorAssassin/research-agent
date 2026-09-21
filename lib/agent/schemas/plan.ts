import { z } from 'zod'

export const ResearchPlanSchema = z.object({
  objective: z.string().describe('Main research objective'),
  subtasks: z.array(z.string()).min(1),
})

export type ResearchPlan = z.infer<typeof ResearchPlanSchema>
