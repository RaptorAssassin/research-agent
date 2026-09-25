export interface ScrapeProvider {
  scrapePage(url: string): Promise<string>
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function isPdfUrl(url: string, contentType: string): boolean {
  if (contentType.includes("application/pdf") || contentType.includes("application/x-pdf")) return true
  try {
    const u = new URL(url)
    return u.pathname.toLowerCase().endsWith(".pdf")
  } catch {
    return url.toLowerCase().includes(".pdf")
  }
}

async function parsePdfBuffer(buffer: ArrayBuffer, maxChars: number): Promise<string> {
  const { PDFParse } = await import("pdf-parse")
  const data = new Uint8Array(buffer)
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText()
    const text = result.text?.trim() ?? ""
    if (!text) throw new Error("PDF returned empty text")
    return text.slice(0, maxChars)
  } finally {
    await parser.destroy().catch(() => {})
  }
}

export class SimpleScrapeProvider implements ScrapeProvider {
  private readonly timeoutMs: number
  private readonly maxChars: number

  constructor(opts: { timeoutMs?: number; maxChars?: number } = {}) {
    this.timeoutMs = opts.timeoutMs ?? 12000
    this.maxChars = opts.maxChars ?? 12000
  }

  private headersFor(url: string, attempt: number): Record<string, string> {
    const base: Record<string, string> = {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/pdf;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,de;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    }
    if (attempt === 0) {
      return {
        ...base,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      }
    }
    return {
      ...base,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Referer: "https://www.google.com/",
    }
  }

  async scrapePage(url: string): Promise<string> {
    let response: Response | null = null
    let lastErr = ""
    const maxAttempts = 2

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        response = await fetch(url, {
          headers: this.headersFor(url, attempt),
          signal: AbortSignal.timeout(this.timeoutMs),
          redirect: "follow",
        })
      } catch (cause) {
        lastErr = cause instanceof Error ? cause.message : String(cause)
        const isTimeout = lastErr.toLowerCase().includes("timeout") || lastErr.toLowerCase().includes("aborted")
        if (isTimeout && attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          continue
        }
        throw new Error(`Scrape fetch failed for ${url}: ${lastErr}`)
      }

      if (response.ok) break

      const status = response.status
      lastErr = `${status} ${response.statusText}`

      const retryable = [403, 429, 502, 503, 504].includes(status)
      if (retryable && attempt < maxAttempts - 1) {
        const backoff = status === 403 ? 600 : status === 429 ? 1200 : 700
        let bodyHint = ""
        try {
          bodyHint = (await response.clone().text()).slice(0, 200)
        } catch {}
        console.warn(`[scrape] ${status} for ${url} — retry ${attempt + 1}/${maxAttempts - 1} hint: ${bodyHint.slice(0, 80)}`)
        await new Promise((r) => setTimeout(r, backoff * (attempt + 1)))
        continue
      }

      throw new Error(`Scrape failed ${status} ${response.statusText} for ${url}`)
    }

    if (!response) {
      throw new Error(`Scrape failed: no response for ${url} — last: ${lastErr}`)
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase()

    if (isPdfUrl(url, contentType)) {
      let buffer: ArrayBuffer
      try {
        buffer = await response.arrayBuffer()
      } catch (cause) {
        throw new Error(`Scrape PDF read failed for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`)
      }
      if (buffer.byteLength === 0) throw new Error(`Scrape returned empty PDF for ${url}`)
      if (buffer.byteLength > 15 * 1024 * 1024) {
        console.warn(`[scrape] PDF too large ${buffer.byteLength} bytes for ${url}, truncating`)
      }
      try {
        const text = await parsePdfBuffer(buffer, this.maxChars)
        if (!text) throw new Error(`PDF returned empty content for ${url}`)
        return text
      } catch (cause) {
        throw new Error(`PDF parse failed for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`)
      }
    }

    if (contentType.includes("application/json")) {
      let jsonText: string
      try {
        jsonText = await response.text()
      } catch (cause) {
        throw new Error(`Scrape read failed for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`)
      }
      const trimmed = jsonText.trim().slice(0, this.maxChars)
      if (!trimmed) throw new Error(`Scrape returned empty JSON for ${url}`)
      return trimmed
    }

    let html: string
    try {
      html = await response.text()
    } catch (cause) {
      throw new Error(`Scrape read failed for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`)
    }

    const text = stripHtml(html)
    if (!text) {
      throw new Error(`Scrape returned empty content for ${url}`)
    }

    return text.slice(0, this.maxChars)
  }
}

export class MockScrapeProvider implements ScrapeProvider {
  async scrapePage(url: string): Promise<string> {
    return `Mock scraped content for ${url} — replace with SimpleScrapeProvider in production.`
  }
}
