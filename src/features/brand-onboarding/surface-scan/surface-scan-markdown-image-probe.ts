/**
 * One-shot debug: inspect Parallel extract markdown for image/CDN/JSON-LD
 * signals that our strict image-URL regex may miss. Logs stay compact
 * (counts + short samples) so Nest console stays readable.
 */

const SAMPLE_LIMIT = 6;
const CONTEXT_CHARS = 90;

type ProbePattern = {
  id: string;
  /** Case-insensitive global regex. Capture group 1 preferred for samples. */
  re: RegExp;
};

const PROBE_PATTERNS: ProbePattern[] = [
  {
    id: "cdn_shopify",
    re: /cdn\.shopify\.com[^\s"'<>)\]]{0,180}/gi,
  },
  {
    id: "shopify_cdn_files",
    re: /\/cdn\/shop\/files\/[^\s"'<>)\]]{0,180}/gi,
  },
  {
    id: "img_ext_any_url",
    re: /https?:\/\/[^\s"'<>)\]]+\.(?:png|jpe?g|webp|gif|svg|ico|avif)(?:\?[^\s"'<>)\]]*)?/gi,
  },
  {
    id: "markdown_image",
    re: /!\[[^\]]*]\(([^)\s]+)\)/gi,
  },
  {
    id: "html_img_src",
    re: /<img[^>]+src=["']([^"']+)["']/gi,
  },
  {
    id: "og_image",
    re: /(?:og:image|twitter:image)[^h]{0,40}(https?:\/\/[^\s"'<>)\]]+)/gi,
  },
  {
    id: "json_ld",
    re: /application\/ld\+json|@type\s*[":]\s*"Product"|"image"\s*:/gi,
  },
  {
    id: "products_json_hint",
    re: /\/products\.json|ShopifyAnalytics|window\.Shopify/gi,
  },
  {
    id: "http_url_loose",
    re: /https?:\/\/[^\s"'<>)\]]{12,200}/gi,
  },
];

function sampleMatches(markdown: string, re: RegExp): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  re.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null && out.length < SAMPLE_LIMIT) {
    const raw = (match[1] ?? match[0]).slice(0, 160);
    if (seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

function countMatches(markdown: string, re: RegExp): number {
  re.lastIndex = 0;
  return markdown.match(re)?.length ?? 0;
}

/** Snippets where "image" appears near an http URL (catches extension-less CDNs). */
function imageNearHttpSamples(markdown: string): string[] {
  const lower = markdown.toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  let from = 0;
  while (out.length < SAMPLE_LIMIT) {
    const idx = lower.indexOf("image", from);
    if (idx < 0) {
      break;
    }
    const start = Math.max(0, idx - CONTEXT_CHARS);
    const end = Math.min(markdown.length, idx + CONTEXT_CHARS);
    const window = markdown.slice(start, end);
    if (/https?:\/\//i.test(window) && !seen.has(window)) {
      seen.add(window);
      out.push(window.replace(/\s+/g, " ").trim());
    }
    from = idx + 5;
  }
  return out;
}

export type MarkdownImageProbeResult = {
  bundle: string;
  chars: number;
  patterns: Record<string, { count: number; samples: string[] }>;
  imageNearHttpSamples: string[];
};

export function probeMarkdownForImages(
  bundle: string,
  markdown: string,
): MarkdownImageProbeResult {
  const patterns: MarkdownImageProbeResult["patterns"] = {};
  for (const pattern of PROBE_PATTERNS) {
    patterns[pattern.id] = {
      count: countMatches(markdown, pattern.re),
      samples: sampleMatches(markdown, pattern.re),
    };
  }
  return {
    bundle,
    chars: markdown.length,
    patterns,
    imageNearHttpSamples: imageNearHttpSamples(markdown),
  };
}

export function formatMarkdownImageProbeLog(
  domain: string,
  probe: MarkdownImageProbeResult,
): string {
  const patternSummary = Object.entries(probe.patterns)
    .map(([id, value]) => {
      const sample =
        value.samples.length > 0
          ? ` samples=${JSON.stringify(value.samples)}`
          : "";
      return `${id}={count:${value.count}${sample}}`;
    })
    .join(" ");
  const near =
    probe.imageNearHttpSamples.length > 0
      ? ` imageNearHttp=${JSON.stringify(probe.imageNearHttpSamples)}`
      : " imageNearHttp=[]";
  return `surface-scan.markdown_image_probe domain=${domain} bundle=${probe.bundle} chars=${probe.chars} ${patternSummary}${near}`;
}
