# Surface scan, Parallel, Gemini — quick reference

Use this when you want to **tune prompts**, **change scan logic**, or **understand what runs when** (before/after you test on real URLs).

## Where to edit prompts (human-readable)

| What | Path |
|------|------|
| Gemini synthesis instructions + JSON shape | `src/features/brand-onboarding/prompts/surface-scan-synthesis.prompt.md` |
| Loader (reads the `.md` next to compiled code in `dist/`) | `src/features/brand-onboarding/prompts/prompt-loader.ts` |

**Versioning:** the prompt file starts with `PROMPT_VERSION: …`. Bump that string when you change semantics so logs/support can tell which text shipped.

**Build note:** `nest-cli.json` copies `**/*.prompt.md` into `dist/` — restart `nest start` after edits so the runtime file matches.

## How the surface scan pipeline works (today)

High level: **Parallel Extract → bundle markdown → Gemini (JSON-only) → Zod validate → Prisma upsert**.

| Stage | Code | Notes |
|------|------|--------|
| Same-origin URL allowlist | `surface-scan/surface-scan-urls.ts` + `discovery-url.util.ts` | Only re-gated URLs on the **apex hostname** of the lead’s `normalizedUrl`. No first-party blind HTTP to arbitrary hosts. |
| Fetch public pages | `integrations/parallel/parallel-extract.client.ts` | `POST https://api.parallel.ai/v1/extract` with `x-api-key` (`PARALLEL_API_KEY`). `advanced_settings.full_content` requests markdown per URL. Timeout: `PARALLEL_EXTRACT_TIMEOUT_MS` (default 120s). |
| Synthesis | `integrations/gemini/gemini-json.client.ts` | `@google/generative-ai`, `responseMimeType: application/json`. Model: `GEMINI_MODEL` (default `gemini-2.0-flash`). Timeout: `GEMINI_REQUEST_TIMEOUT_MS`. |
| Schema gate | `surface-scan/surface-scan-gemini.schema.ts` | Zod — fail fast if the model drifts. |
| Persist | `surface-scan/http-brand-surface-scan.runner.ts` | Upsert `BrandProfile` by **domain** (apex), replace child `Offering` / `Competitor` / `Location` rows, set `scanStatus` to `SURFACE_COMPLETE`. |
| Unconfigured | `surface-scan/unconfigured-brand-surface-scan.runner.ts` | If **either** vendor key is unset: **new** scans return **503** with a clear message. **Existing** `SURFACE_COMPLETE` profiles still return **`mode: "cached"`** (same short-circuit as the HTTP runner) so the funnel can load real rows without vendors. |

**Runner selection (`brand-onboarding.module.ts`):** both `PARALLEL_API_KEY` and `GEMINI_API_KEY` set → HTTP runner; else → unconfigured runner (503 on new scan; cache hit unchanged).

**Swappable runner token:** `BRAND_SURFACE_SCAN_RUNNER` (`brand-surface-scan.runner.token.ts`) — this is the seam if you later route the same HTTP contract through **MCP** or a **worker**.

## “Already scanned” / don’t burn vendors twice

`POST /api/v1/brand/surface-scan` checks **before** Parallel/Gemini:

- If a `BrandProfile` already exists for the lead’s apex domain **and** `scanStatus === SURFACE_COMPLETE`, the API returns **`mode: "cached"`** with the existing `brandProfileId` and counts (no vendor calls).
- To force a full re-extract: send `{ "leadId": "…", "force": true }` **or** set env `BRAND_SCAN_FORCE_REFRESH=true` (global override for emergencies).

**Re-run from scratch:** deleting the relevant `brand_profiles` row (and children) **and** the `discovery_leads` row for that URL works, subject to Prisma unique keys (`BrandProfile.domain`, `DiscoveryLead.normalizedUrl`). If you only delete children but keep the profile row, you may hit the cache short-circuit unless you `force` or delete the profile.

## Step 1 vs Step 2 — order of checks (guardrails)

### `POST /api/v1/discovery/resolve` (read-only, no triage writes)

1. URL **gate** (syntax, blocked social hosts, private IPs, risky TLDs, etc.).
2. **`org_claimed`** (verified `BrandProfile` + org user) — hard stop with admin email.
3. **Industry bucket** via `IndustryClassifier` (today: stub; later: vendor provider bound to `INDUSTRY_CLASSIFIER`).
4. If bucket is **supported** and a `DiscoveryLead` exists → **`resume`** (optional **`existingBrandProfile`** snapshot is attached when a `BrandProfile` row exists for the apex domain — powers the landing “preview” modal).
5. Otherwise → **`proceed`** (client should call `validate` before scan if there is no lead yet).

**Industry today:** stored on `DiscoveryLead.industry` after `validate` for supported URLs; classifier output is also used when the lead has no industry yet. Product intent (per your note): industry is the **top-level enum** for downstream templates (catalogue, product fetch rules, etc.) — we extend that gradually; surface scan already receives the lead’s industry hint in the Gemini user bundle.

### `POST /api/v1/discovery/validate`

Same gate + org check, then classifier, then **writes** `DiscoveryLead` / `MarketIntelligenceLog` as today.

### `POST /api/v1/brand/surface-scan`

After lead lookup: **cache short-circuit** (above) → else Parallel → Gemini → DB.

## Data retention (today)

Rows written by surface scan (`BrandProfile` and children) are **kept indefinitely**: there is **no TTL**, **no expiry job**, and **no “delete after 30 days if unclaimed”** automation. A future policy may add that; until then, see the explicit decision row in [IMPLEMENTATION_TRACKING.md](./IMPLEMENTATION_TRACKING.md) (Decisions → **Discovery + saved brand retention**).

## Related docs

- [IMPLEMENTATION_TRACKING.md](./IMPLEMENTATION_TRACKING.md) — phased checklist + changelog.
- [AI_GUARDRAILS.md](./AI_GUARDRAILS.md) — safety / hygiene expectations.
- [ENTRY_RESOLVER.md](./ENTRY_RESOLVER.md) — resolve vs validate split.
- OpenAPI: `docs/api/brand-discovery.openapi.yaml` (Step 1 + waitlist + surface-scan entry).
