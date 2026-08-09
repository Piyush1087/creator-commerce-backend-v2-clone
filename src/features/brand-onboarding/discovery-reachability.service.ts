import { Injectable, Logger } from "@nestjs/common";

export type ReachabilityFailureReason =
  | "http_status"
  | "dns_or_timeout"
  | "redirect_hijack";

export type ReachabilityOk = {
  ok: true;
  finalUrl: string;
  contentSignal: "ok" | "parked" | "unreadable" | "foreign_language";
  httpStatus: number;
};

export type ReachabilityFail = {
  ok: false;
  reason: ReachabilityFailureReason;
  httpStatus?: number;
  message: string;
};

export type ReachabilityResult = ReachabilityOk | ReachabilityFail;

const PARKED_RE =
  /domain\s+(for\s+sale|is\s+for\s+sale)|buy\s+this\s+domain|parked\s+domain|coming\s+soon|under\s+construction|lorem\s+ipsum|this\s+domain\s+may\s+be\s+for\s+sale/i;

const NON_LATIN_RE = /[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\u0900-\u097F]/;

/**
 * Lightweight HTTPS probe before Gatekeeper: reachability + parked/foreign/unreadable signals.
 */
@Injectable()
export class DiscoveryReachabilityService {
  private readonly logger = new Logger(DiscoveryReachabilityService.name);
  private readonly timeoutMs = 8_000;

  async probe(normalizedUrl: string): Promise<ReachabilityResult> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(normalizedUrl, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "CreatorShop-DiscoveryProbe/1.0",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
      });

      const finalUrl = response.url || normalizedUrl;
      if (isRedirectHijack(normalizedUrl, finalUrl)) {
        this.logger.warn(
          `reachability.redirect_hijack url=${normalizedUrl} final=${finalUrl} ms=${Date.now() - startedAt}`,
        );
        return {
          ok: false,
          reason: "redirect_hijack",
          message:
            "This address routes traffic to an entirely separate destination domain. Please enter the definitive target landing page.",
        };
      }

      if (response.status >= 400) {
        this.logger.warn(
          `reachability.http_fail status=${response.status} url=${normalizedUrl} ms=${Date.now() - startedAt}`,
        );
        return {
          ok: false,
          reason: "http_status",
          httpStatus: response.status,
          message: `Connection Refused: The platform received a server response error (${response.status}) when accessing this URL.`,
        };
      }

      const html = (await response.text()).slice(0, 80_000);
      const contentSignal = detectContentSignal(html);
      this.logger.log(
        `reachability.ok url=${normalizedUrl} status=${response.status} signal=${contentSignal} ms=${Date.now() - startedAt}`,
      );
      return {
        ok: true,
        finalUrl,
        contentSignal,
        httpStatus: response.status,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `reachability.dns_or_timeout url=${normalizedUrl} ms=${Date.now() - startedAt} err=${message}`,
      );
      return {
        ok: false,
        reason: "dns_or_timeout",
        message:
          "Connection Failure: The domain entered cannot be accessed. Please check the address and try again.",
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function apexHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isRedirectHijack(requested: string, finalUrl: string): boolean {
  const a = apexHost(requested);
  const b = apexHost(finalUrl);
  if (!a || !b) return false;
  if (a === b) return false;
  // Allow same registrable second-level if subdomain shift (e.g. brand.com → www.brand.com already stripped).
  return !b.endsWith(`.${a}`) && !a.endsWith(`.${b}`);
}

function detectContentSignal(
  html: string,
): ReachabilityOk["contentSignal"] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < 80 || PARKED_RE.test(html) || PARKED_RE.test(text)) {
    if (PARKED_RE.test(html) || PARKED_RE.test(text)) {
      return "parked";
    }
    return "unreadable";
  }

  const langMatch = html.match(/<html[^>]*\slang=["']([^"']+)["']/i);
  const lang = langMatch?.[1]?.toLowerCase() ?? "";
  if (lang && !lang.startsWith("en")) {
    return "foreign_language";
  }

  const sample = text.slice(0, 2000);
  const nonLatin = (sample.match(NON_LATIN_RE) ?? []).length;
  if (sample.length > 200 && nonLatin / sample.length > 0.25) {
    return "foreign_language";
  }

  return "ok";
}
