# AI guardrails (Parallel.ai + Gemini)

This document captures **non-functional requirements** for vendor-backed
extraction and synthesis. Expand as implementation lands.

## Principles

- **SSRF safety:** never crawl or fetch from the hot validation path without an
  allowlisted fetcher, DNS re-check, and private-IP blocking for resolved hosts.
- **Data minimization:** only persist fields required for onboarding and
  campaign workflows; redact secrets and tokens from logs.
- **Prompt hygiene:** keep prompts in dedicated `prompts/` modules with version
  identifiers in code comments or a `PROMPT_VERSION` constant.
- **Rate limits:** respect vendor quotas; add server-side throttles per IP and
  per domain.
- **Robots / ToS:** document crawl policy per environment; default to
  conservative scope (homepage, public catalogue paths) until legal approves
  broader crawling.

## Parallel.ai

- Use official SDK/HTTP with timeouts and retries with backoff.
- Prefer structured outputs / JSON schemas where supported.
- Store raw vendor payloads only when needed for audit; otherwise map into
  Prisma columns and JSON fields on `BrandProfile` / children.

## Gemini

- Use stable model IDs via configuration (no hard-coded secrets).
- Validate JSON against Zod (or equivalent) at service boundaries.
- Strip PII from prompt attachments unless contractually allowed.

## Future work

- Webhook signatures if Parallel moves to async jobs.
- Content safety filters for user-visible copy generated from scans.
