import { z } from 'zod'

export interface LLMProvider {
  generate(prompt: string): Promise<string>
  structuredGenerate<T>(prompt: string, schema: z.ZodType<T>): Promise<T>
}

export type LLMOptions = {
    model?: string
    baseUrl?: string
    temperature?: number
}