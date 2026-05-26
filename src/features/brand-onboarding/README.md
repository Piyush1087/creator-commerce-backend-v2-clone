# Brand onboarding (Step 1 gatekeeper + journey shell)

Nest feature module for **brand URL validation** (Step 1) and future onboarding
APIs. Controllers own HTTP shape only; services own persistence and triage.

## Route (stable contract)

- `POST /api/v1/discovery/validate`
- `POST /api/v1/discovery/resolve` (read-only entry resolver; see
  `docs/brand-onboarding/ENTRY_RESOLVER.md`)

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
  `brand-onboarding.controller.ts`); global defaults in `app.module.ts`.
- **Logging**: URLs and IPs are redacted in service logs (`discovery-redaction.ts`).
- **Org already claimed:** when a `BrandProfile` exists for the domain, is
  verified, has an `organizationId`, and the org has at least one `User`, the API
  returns `outcome: org_claimed` with `adminEmail` (first org user by
  `createdAt`) for the invitation modal.

## Persistence

- Supported path: `discovery_leads`
- Unsupported / gate failures: `market_intelligence_logs` (unique `domain_name`)
- Waitlist submissions: `waitlist_leads` (future endpoint; schema ready)

See `docs/database/brand-discovery-and-users.md`.

## Engineering tracking

See `docs/brand-onboarding/IMPLEMENTATION_TRACKING.md`.
