export type ParallelSearchRequest = {
  objective?: string | null;
  /** At least one query required by API; 2–3 recommended. */
  search_queries: string[];
  mode?: "basic" | "advanced" | null;
  max_chars_total?: number | null;
  session_id?: string | null;
  client_model?: string | null;
};

export type ParallelSearchResultRow = {
  url: string;
  title?: string;
  publish_date?: string | null;
  excerpts?: string[];
};

export type ParallelSearchResponse = {
  search_id: string;
  results: ParallelSearchResultRow[];
  warnings?: unknown;
  usage?: unknown;
  session_id: string;
};
