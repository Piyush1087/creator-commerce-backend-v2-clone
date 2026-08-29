export type InstagramProviderErrorClass =
  | "TRANSIENT"
  | "AUTHORIZATION_REVALIDATION_REQUIRED"
  | "PERMISSION_LOSS"
  | "PROVIDER_ACCESS_BLOCKED"
  | "CONTENT_OR_METRIC_UNAVAILABLE"
  | "UNKNOWN";

export type InstagramProviderErrorMetadata = {
  classification: InstagramProviderErrorClass;
  httpStatus: number;
  providerCode: number | null;
  providerSubcode: number | null;
  isTransient: boolean | null;
};

type ProviderEnvelope = {
  error?: {
    code?: unknown;
    error_subcode?: unknown;
    is_transient?: unknown;
  };
};

export function classifyInstagramProviderError(
  httpStatus: number,
  body: unknown,
): InstagramProviderErrorMetadata {
  const envelope = isRecord(body) ? (body as ProviderEnvelope) : {};
  const error = isRecord(envelope.error) ? envelope.error : {};
  const providerCode = numberOrNull(error.code);
  const providerSubcode = numberOrNull(error.error_subcode);
  const isTransient =
    typeof error.is_transient === "boolean" ? error.is_transient : null;

  let classification: InstagramProviderErrorClass = "UNKNOWN";
  if (isTransient || httpStatus === 429 || httpStatus >= 500) {
    classification = "TRANSIENT";
  } else if ([190, 102].includes(providerCode ?? -1)) {
    classification = "AUTHORIZATION_REVALIDATION_REQUIRED";
  } else if ([10, 200, 294].includes(providerCode ?? -1)) {
    classification = "PERMISSION_LOSS";
  } else if ([368, 360, 459].includes(providerCode ?? -1)) {
    classification = "PROVIDER_ACCESS_BLOCKED";
  } else if ([100].includes(providerCode ?? -1)) {
    classification = "CONTENT_OR_METRIC_UNAVAILABLE";
  }

  return {
    classification,
    httpStatus,
    providerCode,
    providerSubcode,
    isTransient,
  };
}

export async function safeInstagramErrorMetadata(
  response: Response,
): Promise<InstagramProviderErrorMetadata> {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(await response.text()) as unknown;
  } catch {
    parsed = null;
  }
  return classifyInstagramProviderError(response.status, parsed);
}

export function renderSafeInstagramError(
  operation: string,
  metadata: InstagramProviderErrorMetadata,
): string {
  return [
    `instagram.provider_error operation=${operation}`,
    `httpStatus=${metadata.httpStatus}`,
    `classification=${metadata.classification}`,
    `code=${metadata.providerCode ?? "unknown"}`,
    `subcode=${metadata.providerSubcode ?? "unknown"}`,
    `transient=${metadata.isTransient ?? "unknown"}`,
  ].join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
