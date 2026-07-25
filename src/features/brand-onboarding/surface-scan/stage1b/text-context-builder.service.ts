import { Injectable } from "@nestjs/common";
import * as cheerio from "cheerio";

import {
  RUNTIME_CONTEXT_MAX_CHARS,
  type RuntimeContextPage,
} from "./runtime-context.types";

type CheerioRoot = ReturnType<typeof cheerio.load>;

export type BuiltPageContext = RuntimeContextPage & {
  colors: string[];
  fonts: string[];
  nav_labels: string[];
  logo: string | null;
};

/**
 * Phase 5 Text Context Builder — strips chrome/scripts and collapses whitespace
 * so Gemini receives clean page text only (never raw HTML). Also extracts
 * title, nav labels, colors/fonts (best-effort), and same-host internal links.
 */
@Injectable()
export class TextContextBuilderService {
  build(pages: Array<{ url: string; html: string }>): BuiltPageContext[] {
    return pages.map((page) => this.buildOne(page));
  }

  private buildOne(page: { url: string; html: string }): BuiltPageContext {
    const $ = cheerio.load(page.html);

    const title =
      $("title").first().text().replace(/\s+/g, " ").trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      undefined;

    const nav_labels = extractNavLabels($);
    const colors = extractColors($, page.html);
    const fonts = extractFonts($, page.html);
    const logo = extractLogo($, page.url);
    const internal_links = extractInternalLinks($, page.url);

    // Strip chrome after nav/meta extraction so clean_text stays content-only.
    $(
      "script, style, svg, nav, footer, iframe, noscript, header, head, link, meta",
    ).remove();
    const bodyText = $("body").text() || $.root().text();
    const collapsed = bodyText.replace(/\s+/g, " ").trim();
    const clean_text =
      collapsed.length <= RUNTIME_CONTEXT_MAX_CHARS
        ? collapsed
        : collapsed.slice(0, RUNTIME_CONTEXT_MAX_CHARS);

    return {
      url: page.url,
      page_type: inferPageType(page.url),
      title,
      clean_text,
      internal_links: internal_links.length > 0 ? internal_links : undefined,
      colors,
      fonts,
      nav_labels,
      logo,
    };
  }
}

function inferPageType(url: string): string {
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    pathname = url.toLowerCase();
  }
  if (pathname === "/" || pathname === "") return "homepage";
  if (pathname.includes("about") || pathname.includes("our-story")) {
    return "about";
  }
  if (pathname.includes("pricing") || pathname.includes("plan")) {
    return "pricing";
  }
  if (
    pathname.includes("product") ||
    pathname.includes("service") ||
    pathname.includes("shop") ||
    pathname.includes("collection")
  ) {
    return "offerings";
  }
  return "general_context";
}

function extractNavLabels($: CheerioRoot): string[] {
  const labels = new Set<string>();
  $("nav a, header nav a, [role='navigation'] a").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text && text.length <= 60) {
      labels.add(text);
    }
  });
  return [...labels].slice(0, 40);
}

function extractColors($: CheerioRoot, html: string): string[] {
  const colors = new Set<string>();
  const theme =
    $('meta[name="theme-color"]').attr("content")?.trim() ||
    $('meta[name="msapplication-TileColor"]').attr("content")?.trim();
  if (theme && isColorToken(theme)) {
    colors.add(normalizeColor(theme));
  }

  const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
  for (const block of styleBlocks) {
    const hexes = block.match(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g) ?? [];
    for (const hex of hexes) {
      colors.add(normalizeColor(hex));
      if (colors.size >= 12) break;
    }
    if (colors.size >= 12) break;
  }

  // CSS custom properties commonly used for brand palettes.
  const varColors =
    html.match(
      /--(?:brand|primary|secondary|accent)[^:]*:\s*(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/gi,
    ) ?? [];
  for (const decl of varColors) {
    const match = decl.match(/(#[0-9a-fA-F]{3,8}|rgb[a]?\([^)]+\))/i);
    if (match?.[1] && isColorToken(match[1])) {
      colors.add(normalizeColor(match[1]));
    }
  }

  return [...colors].slice(0, 12);
}

function extractFonts($: CheerioRoot, html: string): string[] {
  const fonts = new Set<string>();

  $('link[rel="stylesheet"][href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const familyMatch = href.match(/family=([^&]+)/i);
    if (!familyMatch?.[1]) return;
    for (const part of decodeURIComponent(familyMatch[1]).split("|")) {
      const name = part.split(":")[0]?.replace(/\+/g, " ").trim();
      if (name) fonts.add(name);
    }
  });

  const familyDecls =
    html.match(/font-family\s*:\s*([^;}{]+)/gi) ?? [];
  for (const decl of familyDecls) {
    const raw = decl.replace(/font-family\s*:\s*/i, "");
    for (const piece of raw.split(",")) {
      const name = piece
        .replace(/["']/g, "")
        .replace(/!important/gi, "")
        .trim();
      if (
        name &&
        !/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|inherit|initial|unset)$/i.test(
          name,
        )
      ) {
        fonts.add(name);
      }
    }
    if (fonts.size >= 8) break;
  }

  return [...fonts].slice(0, 8);
}

function extractLogo($: CheerioRoot, pageUrl: string): string | null {
  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('link[rel="apple-touch-icon"]').attr("href"),
    $('link[rel="icon"]').attr("href"),
    $("img[class*='logo' i], img[id*='logo' i], img[alt*='logo' i]")
      .first()
      .attr("src"),
  ];
  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    try {
      return new URL(raw.trim(), pageUrl).toString();
    } catch {
      continue;
    }
  }
  return null;
}

function extractInternalLinks(
  $: CheerioRoot,
  pageUrl: string,
): string[] {
  let originHost = "";
  try {
    originHost = apexHost(new URL(pageUrl).hostname);
  } catch {
    return [];
  }

  const links = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) return;
    try {
      const abs = new URL(href, pageUrl);
      if (apexHost(abs.hostname) !== originHost) return;
      abs.hash = "";
      abs.search = "";
      links.add(abs.toString());
    } catch {
      // ignore malformed
    }
  });
  return [...links].slice(0, 30);
}

function apexHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function isColorToken(value: string): boolean {
  return (
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim()) ||
    /^rgb/i.test(value.trim())
  );
}

function normalizeColor(value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase();
  }
  if (v.startsWith("#")) return v.toLowerCase();
  return v;
}
