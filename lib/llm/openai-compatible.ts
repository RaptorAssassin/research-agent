import { z } from 'zod'
import type { LLMProvider, LLMOptions } from './provider'

type ChatContentPart = {
  type: string
  text?: string
}

type ChatMessage = {
  content: string | ChatContentPart[]
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: ChatMessage
  }>
  error?: { message?: string }
}

function resolveBaseUrl(explicit?: string): string {
  const raw = explicit ?? process.env.OPENAI_COMPATIBLE_API_URL ?? ''
  return raw.trim().replace(/\/+$/, '')
}

function resolveApiKey(explicit?: string): string {
  const raw = explicit ?? process.env.OPENAI_COMPATIBLE_API_KEY ?? ''
  return raw.trim()
}

function endpointFor(baseUrl: string): string {
  return baseUrl.endsWith('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`
}

function messageToText(message: ChatMessage | undefined): string {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => part.text ?? '')
      .join('')
  }
  return ''
}

function stripFences(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return (fenced?.[1] ?? trimmed).trim()
}

export class OpenAICompatibleProvider implements LLMProvider {
  private readonly model: string
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly temperature?: number

  constructor(opts: LLMOptions = {}) {
    const baseUrl = resolveBaseUrl(opts.baseUrl)
    if (!baseUrl) {
      throw new Error(
        'Missing OPENAI_COMPATIBLE_API_URL — copy .env.example to .env.local and set it, e.g. https://openrouter.ai/api/v1'
      )
    }
    if (!opts.model) {
      throw new Error(
        'Missing model for OpenAICompatibleProvider — set OPENAI_COMPATIBLE_CHEAP_MODEL / OPENAI_COMPATIBLE_STRONG_MODEL or OPENAI_COMPATIBLE_MODEL'
      )
    }
    this.model = opts.model
    this.baseUrl = baseUrl
    this.apiKey = resolveApiKey(opts.apiKey)
    this.temperature = opts.temperature
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }
    return headers
  }

  private async postChatCompletion(body: Record<string, unknown>): Promise<string> {
    const url = endpointFor(this.baseUrl)
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      })
    } catch (cause) {
      throw new Error(
        `OpenAI-compatible endpoint not reachable at ${url} — check OPENAI_COMPATIBLE_API_URL (cause: ${cause instanceof Error ? cause.message : String(cause)})`
      )
    }

    let data: ChatCompletionResponse
    try {
      data = (await response.json()) as ChatCompletionResponse
    } catch {
      throw new Error(
        `OpenAI-compatible endpoint returned non-JSON response (status ${response.status})`
      )
    }

    if (!response.ok) {
      throw new Error(
        `OpenAI-compatible request failed with status ${response.status}: ${JSON.stringify(data).slice(0, 500)}`
      )
    }

    const text = messageToText(data.choices?.[0]?.message)
    if (!text) {
      throw new Error(
        `OpenAI-compatible response is missing choices[0].message.content: ${JSON.stringify(data).slice(0, 500)}`
      )
    }
    return text
  }

  async generate(prompt: string): Promise<string> {
    return this.postChatCompletion({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      ...(this.temperature !== undefined ? { temperature: this.temperature } : {}),
    })
  }

  async structuredGenerate<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    const jsonSchema = z.toJSONSchema(schema)
    const basePrompt = `${prompt}\nRespond ONLY with valid JSON matching the schema. No prose, no markdown, no extra keys.`

    const baseBody = {
      model: this.model,
      messages: [{ role: 'user', content: basePrompt }],
      stream: false,
      ...(this.temperature !== undefined ? { temperature: this.temperature } : {}),
    }

    const attempt = async (
      responseFormat: Record<string, unknown> | undefined,
      currentPrompt: string
    ): Promise<T> => {
      const raw = await this.postChatCompletion({
        ...baseBody,
        messages: [{ role: 'user', content: currentPrompt }],
        ...(responseFormat ? { response_format: responseFormat } : {}),
      })
      let parsed: unknown
      try {
        parsed = JSON.parse(stripFences(raw))
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause)
        throw new Error(
          `OpenAI-compatible endpoint returned invalid JSON: ${msg} — raw: ${raw.slice(0, 500)}`
        )
      }
      return schema.parse(parsed)
    }

    const strictFormat = {
      type: 'json_schema',
      json_schema: { name: 'response', schema: jsonSchema, strict: true },
    }
    const lenientFormat = { type: 'json_object' }

    try {
      try {
        return await attempt(strictFormat, basePrompt)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const unsupported =
          message.includes('status 400') ||
          message.toLowerCase().includes('response_format') ||
          message.toLowerCase().includes('json_schema')
        if (!unsupported) throw error
        return await attempt(lenientFormat, basePrompt)
      }
    } catch (error) {
      const isParseError =
        error instanceof SyntaxError ||
        error instanceof z.ZodError ||
        (error instanceof Error &&
          error.message.startsWith('OpenAI-compatible endpoint returned invalid JSON'))

      if (!isParseError) throw error

      const detail =
        error instanceof z.ZodError
          ? z.prettifyError(error)
          : error instanceof Error
            ? error.message
            : String(error)
      const retryPrompt = `${basePrompt}\n\nYour previous output was not valid JSON for the schema: ${detail}. Fix it and return ONLY valid JSON.`

      try {
        return await attempt(lenientFormat, retryPrompt)
      } catch (retryError) {
        const retryDetail =
          retryError instanceof z.ZodError
            ? z.prettifyError(retryError)
            : retryError instanceof Error
              ? retryError.message
              : String(retryError)
        throw new Error(
          `Failed to parse structured response after retry: ${retryDetail}`
        )
      }
    }
  }
}
