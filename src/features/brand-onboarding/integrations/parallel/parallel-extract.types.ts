export type ParallelExtractRequest = {
  urls: string[];
  objective: string;
  advanced_settings?: {
    full_content?: {
      max_chars_per_result?: number;
    };
  };
};

export type ParallelExtractResultRow = {
  url: string;
  title?: string;
  publish_date?: string;
  excerpts?: string[];
  full_content?: string;
};

export type ParallelExtractResponse = {
  extract_id?: string;
  results: ParallelExtractResultRow[];
  errors?: unknown[];
  warnings?: unknown;
};
