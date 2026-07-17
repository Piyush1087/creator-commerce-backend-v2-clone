import { Logger } from "@nestjs/common";

import { gateAndNormalizeBrandUrl } from "../discovery-url.util";
import type { Step2SurfaceScanGeminiPayload } from "./surface-scan-gemini.schema";

const logger = new Logger("ShopifyProductsJsonEnricher");

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 4_000_000;
const MAX_PAGES = 3;
const PAGE_LIMIT = 250;
const MIN_TITLE_SCORE = 40;

type ShopifyProductImage = {
  src?: string;
};

type ShopifyProduct = {
  title?: string;
  handle?: string;
  image?: ShopifyProductImage | null;
  images?: ShopifyProductImage[];
};

type ShopifyProductsJson = {
  products?: ShopifyProduct[];
};

export type ShopifyEnrichResult = {
  status:
    | "enriched"
    | "not_shopify_json"
    | "fetch_failed"
    | "gate_blocked"
    | "empty";
  catalogCount: number;
  filled: number;
  matched: number;
  samples: Array<{
    name: string;
    matchedTitle: string | null;
    handle: string | null;
    score: number;
    imageUrl: string;
  }>;
};

function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function productHandleFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/products\/([^/]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]).toLowerCase() : null;
  } catch {
    return null;
  }
}

function primaryImageUrl(product: ShopifyProduct): string | null {
  for (const item of product.images ?? []) {
    const src = item.src?.trim();
    if (src && /^https?:\/\//i.test(src)) {
      return src;
    }
  }
  const fromImage = product.image?.src?.trim();
  if (fromImage && /^https?:\/\//i.test(fromImage)) {
    return fromImage;
  }
  return null;
}

function scoreTitleMatch(geminiName: string, shopifyTitle: string): number {
  const a = normalizeMatchText(geminiName);
  const b = normalizeMatchText(shopifyTitle);
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 100;
  }
  if (a.includes(b) || b.includes(a)) {
    return 85;
  }
  const aTokens = a.split(" ").filter((t) => t.length >= 3);
  const bTokens = b.split(" ").filter((t) => t.length >= 3);
  if (aTokens.length === 0 || bTokens.length === 0) {
    return 0;
  }
  const bSet = new Set(bTokens);
  let overlap = 0;
  for (const token of aTokens) {
    if (bSet.has(token)) {
      overlap += 1;
    }
  }
  if (overlap === 0) {
    return 0;
  }
  const coverage = overlap / aTokens.length;
  const density = overlap / Math.max(bTokens.length, 1);
  return Math.round(coverage * 55 + density * 35 + Math.min(overlap, 4) * 2);
}

function looksLikeShopifyCatalog(
  payload: unknown,
): payload is ShopifyProductsJson {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return Array.isArray((payload as ShopifyProductsJson).products);
}

async function fetchJsonPage(
  url: string,
): Promise<
  | { ok: true; products: ShopifyProduct[] }
  | { ok: false; status: ShopifyEnrichResult["status"]; detail: string }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/json,text/plain,*/*",
        "User-Agent": "CreatorShopBrandScan/2.0",
      },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return {
        ok: false,
        status: "fetch_failed",
        detail: `too_large bytes=${buffer.byteLength}`,
      };
    }
    const text = buffer.toString("utf8");
    if (!response.ok) {
      return {
        ok: false,
        status: "fetch_failed",
        detail: `http_${response.status} contentType=${contentType}`,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return {
        ok: false,
        status: "not_shopify_json",
        detail: `contentType=${contentType} bytes=${buffer.byteLength} sample=${JSON.stringify(text.slice(0, 160))}`,
      };
    }
    if (!looksLikeShopifyCatalog(parsed)) {
      return {
        ok: false,
        status: "not_shopify_json",
        detail: `unexpected_shape contentType=${contentType}`,
      };
    }
    return { ok: true, products: parsed.products ?? [] };
  } catch (err: unknown) {
    return {
      ok: false,
      status: "fetch_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchShopifyProductsJson(domain: string): Promise<{
  status: ShopifyEnrichResult["status"];
  products: ShopifyProduct[];
}> {
  const gated = gateAndNormalizeBrandUrl(`https://${domain}/products.json`, {
    keepPath: true,
  });
  if (!gated.ok || gated.hostname !== domain) {
    return { status: "gate_blocked", products: [] };
  }

  const all: ShopifyProduct[] = [];
  const seenHandles = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageUrl = `https://${domain}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
    const pageResult = await fetchJsonPage(pageUrl);
    if (!pageResult.ok) {
      if (page === 1) {
        logger.warn(
          `shopify.products_json_${pageResult.status} domain=${domain} ${pageResult.detail}`,
        );
        return { status: pageResult.status, products: [] };
      }
      break;
    }
    if (pageResult.products.length === 0) {
      break;
    }
    for (const product of pageResult.products) {
      const handle = product.handle?.trim().toLowerCase() ?? "";
      if (handle && seenHandles.has(handle)) {
        continue;
      }
      if (handle) {
        seenHandles.add(handle);
      }
      all.push(product);
    }
    if (pageResult.products.length < PAGE_LIMIT) {
      break;
    }
  }

  if (all.length === 0) {
    return { status: "empty", products: [] };
  }
  return { status: "enriched", products: all };
}

function findBestShopifyMatch(
  productName: string,
  productUrl: string,
  byHandle: Map<string, ShopifyProduct>,
  catalog: ShopifyProduct[],
): { product: ShopifyProduct; score: number } | null {
  const handle = productHandleFromUrl(productUrl);
  if (handle) {
    const exact = byHandle.get(handle);
    if (exact) {
      return { product: exact, score: 100 };
    }
  }

  let best: ShopifyProduct | undefined;
  let bestScore = 0;
  for (const candidate of catalog) {
    const score = scoreTitleMatch(productName, candidate.title ?? "");
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (!best || bestScore < MIN_TITLE_SCORE) {
    return null;
  }
  return { product: best, score: bestScore };
}

/**
 * Enrich Gemini products that lack imageUrl by matching against same-host
 * Shopify `/products.json` (when the endpoint returns a real catalog).
 */
export async function enrichProductsFromShopifyJson(
  domain: string,
  payload: Step2SurfaceScanGeminiPayload,
): Promise<{
  payload: Step2SurfaceScanGeminiPayload;
  result: ShopifyEnrichResult;
}> {
  const fetched = await fetchShopifyProductsJson(domain);
  if (fetched.status !== "enriched") {
    const result: ShopifyEnrichResult = {
      status: fetched.status,
      catalogCount: 0,
      filled: 0,
      matched: 0,
      samples: [],
    };
    logger.log(
      `shopify.products_json_enrich domain=${domain} status=${result.status} catalogCount=0 filled=0 matched=0`,
    );
    return { payload, result };
  }

  const byHandle = new Map<string, ShopifyProduct>();
  for (const product of fetched.products) {
    const handle = product.handle?.trim().toLowerCase();
    if (handle) {
      byHandle.set(handle, product);
    }
  }

  let matched = 0;
  let filled = 0;
  const samples: ShopifyEnrichResult["samples"] = [];

  const products = payload.products.map((product) => {
    if (product.imageUrl?.trim()) {
      return product;
    }

    const hit = findBestShopifyMatch(
      product.name,
      product.url,
      byHandle,
      fetched.products,
    );
    if (!hit) {
      return product;
    }
    matched += 1;
    const imageUrl = primaryImageUrl(hit.product);
    if (!imageUrl) {
      return product;
    }
    filled += 1;
    if (samples.length < 6) {
      samples.push({
        name: product.name.slice(0, 60),
        matchedTitle: (hit.product.title ?? "").slice(0, 80),
        handle: hit.product.handle ?? productHandleFromUrl(product.url),
        score: hit.score,
        imageUrl,
      });
    }
    return { ...product, imageUrl };
  });

  const result: ShopifyEnrichResult = {
    status: "enriched",
    catalogCount: fetched.products.length,
    filled,
    matched,
    samples,
  };
  logger.log(
    `shopify.products_json_enrich domain=${domain} status=enriched catalogCount=${result.catalogCount} matched=${result.matched} filled=${result.filled} samples=${JSON.stringify(result.samples)}`,
  );

  return {
    payload: { ...payload, products },
    result,
  };
}
