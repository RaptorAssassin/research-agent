import type { Source } from "../agent/schemas/claim"

export interface SearchProvider {
  searchWeb(query: string): Promise<SourcePreview[]>
}

export type SourcePreview = Pick<Source, "url" | "title" | "snippet" | "publishedAt"> & {
  score?: number
}