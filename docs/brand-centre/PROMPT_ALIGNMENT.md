# Brand Centre — prompt alignment

**Rule:** Gemini system instructions live in **human-readable `.prompt.md` files** in source (same pattern as brand-onboarding). Product text in `product-team-docs/` is the reference; code prompts are edited copies that stay in sync.

Do **not** embed short “AI engineering” prompt strings in TypeScript. Workers call `loadPromptMarkdown("…")` and pass runtime context in **user** text (JSON bundles, URLs, etc.).

---

## Onboarding pattern (copy this)

| Piece | Location |
| --- | --- |
| Prompt files | `src/features/brand-onboarding/prompts/*.prompt.md` |
| Loader | `prompt-loader.ts` → `readFileSync` from `__dirname` in `dist/` |
| Build | `nest-cli.json` copies `**/*.prompt.md` to `dist/` |
| Versioning | `PROMPT_VERSION:` line at top of each file |
| Gemini | `GeminiJsonClient.generateJson({ systemInstruction, userText })` |
| Parallel | `ParallelExtractClient` / `ParallelSearchClient` in onboarding integrations |
| Validation | Zod schema next to feature (`surface-scan-gemini.schema.ts`) |

See also: `docs - Copy/brand-onboarding/SURFACE_SCAN_AND_PROMPTS.md`.

---

## Brand Centre — product doc → code file

| Product source | Event | Code prompt file | Zod output schema |
| --- | --- | --- | --- |
| `BrandCentre-deepScanLogic.md` + `BrandCentre-developerDocument.md` Prompt 1 | Event 2 deep scan | `deep-scan-strategy.prompt.md` | `schemas/deep-scan-prompt1.schema.ts` (Slice 4) |
| Same, Prompt 2 | Event 3 intelligence | `intelligence-leaks.prompt.md` | `schemas/intelligence-prompt2.schema.ts` |
| Same, Prompt 3 | Event 4 planner | `planner-aggregator.prompt.md` | `schemas/planner-prompt3.schema.ts` |

Product docs (read-only): `product-team-docs/BrandCentre-deepScanLogic.md`, `BrandCentre-developerDocument.md`, `BrandCentre-validations.md`.

---

## Parallel + Gemini in deep scan (planned)

| Stage | Reuse from onboarding | Brand Centre–specific |
| --- | --- | --- |
| PDP / extra extract | `ParallelExtractClient` | Optional extra URLs from existing offerings |
| Synthesis | `GeminiJsonClient` | `loadPromptMarkdown("deep-scan-strategy.prompt.md")` |
| Inputs | Surface scan DB rows + stored scrape bundles | Worker builds `userText` with `BRAND_URL`, `ROUTING_TYPE`, products JSON, etc. |

Cold start (Event 1) uses **config templates only** — no Gemini prompt file.

---

## Keeping prompts in sync

1. Product changes spec → update `product-team-docs/` (product team).
2. Engineering copies/adapts into `src/features/brand-centre/prompts/*.prompt.md`.
3. Bump `PROMPT_VERSION` in the `.md` file.
4. Adjust Zod schema if JSON shape changes.
5. Note in PR: product section → prompt file + version.

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-05-27 | Initial alignment doc; three `.prompt.md` files added (worker not wired yet) |
