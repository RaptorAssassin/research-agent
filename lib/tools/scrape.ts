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

export class SimpleScrapeProvider implements ScrapeProvider {
  private readonly timeoutMs: number
  private readonly maxChars: number

  constructor(opts: { timeoutMs?: number; maxChars?: number } = {}) {
    this.timeoutMs = opts.timeoutMs ?? 8000
    this.maxChars = opts.maxChars ?? 8000
  }

  async scrapePage(url: string): Promise<string> {
    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "research-agent/0.1 (+https://github.com/research-agent)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (cause) {
      throw new Error(`Scrape fetch failed for ${url}: ${cause instanceof Error ? cause.message : String(cause)}`)
    }

    if (!response.ok) {
      throw new Error(`Scrape failed ${response.status} for ${url}`)
    }

    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json") || contentType.includes("application/pdf")) {
      throw new Error(`Unsupported content-type ${contentType} for ${url}`)
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
