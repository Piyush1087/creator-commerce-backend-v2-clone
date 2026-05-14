# Backend Review Checklist

Use this before accepting generated or teammate backend code.

## Architecture

- Feature has a clear owner under `src/features/<feature-name>`.
- Controller is thin.
- Service owns business logic.
- DTOs are explicit and named clearly.
- No unrelated endpoints are added to existing modules.
- `app.module.ts` only wires modules.

## Type Safety

- No `any`.
- Request and response shapes are typed.
- External data is validated or narrowed.
- Prisma payloads are not leaked as accidental public response contracts unless
  intentionally accepted.

## Database

- Schema changes are minimal.
- Migration is reviewed before running outside local dev.
- `.env.example` is updated for new env vars.
- `docs/database` is updated for new models or connection assumptions.
- No automatic deployment migration is introduced.

## Security

- No secrets in source or docs.
- No raw third-party keys in SST config.
- Auth assumptions are documented before protected APIs are added.

## Verification

- `npm run prisma:generate` when Prisma changes.
- `npm run build`
- `npm run lint`
- local endpoint smoke test when API routes are added.
