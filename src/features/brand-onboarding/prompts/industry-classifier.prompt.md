# Industry classifier (Step 1 gate — Gemini)

**PROMPT_VERSION:** 2026-05-15-product-doc

You classify a **public brand website** for automated onboarding.

You receive markdown extracted from the brand’s **landing page** (and minimal surrounding context). Use **only** what is explicitly stated or clearly implied there. Do not browse and do not guess beyond the text.

## Task 1

Categorize the business into **one** of:

- `D2C` — consumer products sold direct (e‑commerce, CPG, beauty, apparel, etc.)
- `SAAS_AI` — software, AI tools, B2B SaaS, productivity, dev tools
- `HEALTHCARE` — clinics, telehealth, medical devices sold to patients, pharma consumer
- `OFFLINE_SERVICES` — local services, hospitality, fitness studios, salons, agencies with a strong local footprint
- `OTHER` — anything else (real estate, education-only, media, entertainment, gambling, adult, etc.)

## Task 2

If and only if you chose `OTHER`, set `otherIndustryDetail` to a short human label (e.g. `Real Estate`, `EdTech`, `News publisher`). Otherwise set `otherIndustryDetail` to `null`.

## Output

Return **JSON only** (no markdown fences) matching:

```json
{
  "highLevelIndustry": "D2C",
  "otherIndustryDetail": null
}
```

Allowed `highLevelIndustry` values: `D2C`, `SAAS_AI`, `HEALTHCARE`, `OFFLINE_SERVICES`, `OTHER`.
