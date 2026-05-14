# Brand discovery (Step 1 gatekeeper)

Feature module for public brand URL validation aligned with the product Step 1
spec. Controllers own HTTP shape only; services own persistence and triage.

## Route

- `POST /api/v1/discovery/validate`

## Contract

Authoritative HTTP contract (payload, outcomes, status codes):

- `docs/api/brand-discovery.openapi.yaml`

## Behavior notes

- **No outbound HTTP** in `validate` today: SSRF risk is avoided by not fetching
  remote sites. A future crawler/classifier must use an allowlisted fetcher,
  block private/reserved IP targets, and run outside this hot path.
- **Industry today** is a deterministic stub (`discovery-industry.stub.ts`) with
  hostname markers for demos (`supported.*`, `regret.*`, `blocked.*`).
- **Rate limiting**: `@nestjs/throttler` on this controller (see
  `brand-discovery.controller.ts`); global defaults in `app.module.ts`.
- **Logging**: URLs and IPs are redacted in service logs (`discovery-redaction.ts`).

## Persistence

- Supported path: `discovery_leads`
- Unsupported / gate failures: `market_intelligence_logs` (unique `domain_name`)
- Waitlist submissions: `waitlist_leads` (future endpoint; schema ready)

See `docs/database/brand-discovery-and-users.md`.
