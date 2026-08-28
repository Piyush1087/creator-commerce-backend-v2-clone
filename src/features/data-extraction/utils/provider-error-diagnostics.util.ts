export function credentialFingerprint(value: string | undefined): {
  present: boolean;
  fingerprint: string;
} {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { present: false, fingerprint: "missing" };
  return {
    present: true,
    fingerprint: `len=${trimmed.length},suffix=${trimmed.slice(-4)}`,
  };
}

export function sanitizeProviderMessage(raw: string): string {
  return raw
    .replace(/sk-[a-zA-Z0-9_\-]+/g, "sk-[redacted]")
    .replace(/AIza[0-9A-Za-z_\-]+/g, "AIza[redacted]")
    .replace(/\bAQ\.[0-9A-Za-z_\-]+/g, "AQ.[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|authorization)[=:]\s*\S+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

export function extractProviderHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = error as Record<string, unknown>;
  for (const candidate of [value.status, value.statusCode]) {
    if (typeof candidate === "number") return candidate;
  }
  if (value.error && typeof value.error === "object") {
    const nested = value.error as Record<string, unknown>;
    if (typeof nested.code === "number") return nested.code;
    if (typeof nested.status === "number") return nested.status;
  }
  if (value.cause && typeof value.cause === "object") {
    return extractProviderHttpStatus(value.cause);
  }
  return undefined;
}

export function extractProviderMessage(error: unknown): string {
  if (error instanceof Error) {
    const extra = error as Error & { error?: unknown };
    if (extra.error && typeof extra.error === "object") {
      const nested = extra.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message.trim()) {
        return nested.message;
      }
    }
    return messageFromJsonBlob(error.message) ?? error.message;
  }
  return String(error);
}

function messageFromJsonBlob(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    const nested = parsed.error?.message ?? parsed.message;
    return nested?.trim() ? nested : undefined;
  } catch {
    const match = raw.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
    return match?.[1]?.replace(/\\"/g, '"');
  }
}
