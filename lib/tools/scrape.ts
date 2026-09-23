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

  async scrapePage(url: string): Promise<string> {
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "research-agent/0.1 (+https://github.com/research-agent)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.5",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "follow",
      })
    } catch (cause) {
      throw new Error(`Scrape fetch failed for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`)
    }

    if (!response.ok) {
      throw new Error(`Scrape failed ${response.status} ${response.statusText} for ${url}`)
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
