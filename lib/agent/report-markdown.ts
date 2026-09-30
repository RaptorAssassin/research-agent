import type { Report } from './schemas/report'

function asBullet(text: string): string {
  const trimmed = text.trim().replace(/\n{3,}/g, '\n\n')
  const withoutMarker = trimmed.replace(/^(?:[-•]\s+|\*\s+|\d+[.)]\s+)/, '')
  const lines = withoutMarker.split('\n')
  const first = lines[0].replace(/\s+/g, ' ').trim()
  const rest = lines.slice(1).join('\n').trim()
  return rest ? `- ${first}\n${rest}` : `- ${first || trimmed}`
}

function firstSentence(text: string): string {
  const cleaned = text
    .trim()
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^(?:limitations?|caveats?)\s*[:—–-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const match = cleaned.match(/^.*?[.!?](?=\s|$)/)
  return (match?.[0] ?? cleaned).trim()
}

export function buildReportMarkdown(report: Report): string {
  const sections: string[] = []
  const summary = report.executiveSummary.trim()
  if (summary) sections.push(summary)
  const findings = report.findings
    .map((finding) => finding.trim())
    .filter((finding) => finding.length > 0)
  if (findings.length > 0) {
    sections.push(`## Key findings\n\n${findings.map(asBullet).join('\n')}`)
  }
  const limitations = firstSentence(report.limitations)
  if (limitations) sections.push(`*${limitations}*`)
  return sections.join('\n\n').trim()
}
