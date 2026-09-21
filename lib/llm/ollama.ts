import { z } from 'zod'
import type { LLMProvider, LLMOptions } from './provider'

type OllamaGenerateResponse = {
  response: string
  done: boolean
}

export class OllamaProvider implements LLMProvider {
  private readonly model: string
  private readonly baseUrl: string
  private readonly temperature?: number

  constructor(opts: LLMOptions = {}) {
    this.model = opts.model ?? process.env.OLLAMA_MODEL ?? 'gemma3:12b'
    this.baseUrl = opts.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    this.temperature = opts.temperature
  }

  async generate(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/api/generate`
    let response: Response

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          ...(this.temperature !== undefined ? { options: { temperature: this.temperature } } : {}),
        }),
      })
    } catch (cause) {
      throw new Error(
        `Ollama not reachable at ${this.baseUrl} — is 'ollama serve' running? Run 'ollama run ${this.model}' (cause: ${cause instanceof Error ? cause.message : String(cause)})`,
      )
    }

    let data: OllamaGenerateResponse
    try {
      data = (await response.json()) as OllamaGenerateResponse
    } catch {
      throw new Error(`Ollama returned non-JSON response (status ${response.status})`)
    }

    if (!response.ok) {
      throw new Error(`Ollama API request failed with status ${response.status}: ${JSON.stringify(data)}`)
    }

    if (!data.response) {
      throw new Error('Ollama API response is missing the expected response field')
    }

    return data.response
  }

  async structuredGenerate<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema)
    const basePrompt = `${prompt}\nRespond ONLY with valid JSON matching the schema. No prose, no markdown, no extra keys.`

    const attempt = async (currentPrompt: string): Promise<T> => {
      const url = `${this.baseUrl}/api/generate`
      let response: Response

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt: currentPrompt,
            format: jsonSchema,
            stream: false,
            ...(this.temperature !== undefined ? { options: { temperature: this.temperature } } : {}),
          }),
        })
      } catch (cause) {
        throw new Error(
          `Ollama not reachable at ${this.baseUrl} — is 'ollama serve' running? Run 'ollama run ${this.model}' (cause: ${cause instanceof Error ? cause.message : String(cause)})`,
        )
      }

      let data: OllamaGenerateResponse
      try {
        data = (await response.json()) as OllamaGenerateResponse
      } catch {
        throw new Error(`Ollama returned non-JSON response (status ${response.status})`)
      }

      if (!response.ok) {
        throw new Error(`Ollama API request failed with status ${response.status}: ${JSON.stringify(data)}`)
      }

      if (!data.response) {
        throw new Error('Ollama API response is missing the expected response field')
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(data.response)
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause)
        throw new Error(`Ollama returned invalid JSON: ${msg} — raw: ${data.response.slice(0, 500)}`)
      }

      return schema.parse(parsed)
    }

    try {
      return await attempt(basePrompt)
    } catch (error) {
      const isParseError =
        error instanceof SyntaxError ||
        (error instanceof z.ZodError) ||
        (error instanceof Error && error.message.startsWith('Ollama returned invalid JSON'))

      if (!isParseError) throw error

      const detail = error instanceof z.ZodError ? z.prettifyError(error) : error instanceof Error ? error.message : String(error)
      const retryPrompt = `${basePrompt}\n\nYour previous output was not valid JSON for the schema: ${detail}. Fix it and return ONLY valid JSON.`

      try {
        return await attempt(retryPrompt)
      } catch (retryError) {
        const retryDetail =
          retryError instanceof z.ZodError ? z.prettifyError(retryError) : retryError instanceof Error ? retryError.message : String(retryError)
        throw new Error(`Failed to parse structured response after retry: ${retryDetail}`)
      }
    }
  }
}
