# Identity Developer Test Entry Point

P0 #7 status: CLOSED at Intelligence runtime level.

This is a framework-neutral, development-only entry point for invoking `identity_test`. The developer mounts it inside the application's existing authenticated backend/API framework.

## Safety properties

- returns 404 when `NODE_ENV=production`
- requires authenticated developer/admin authorization supplied by the application
- hardcodes `executionProfileId=identity_test`
- hardcodes `persistResults=false`; request input cannot enable database writes
- accepts a website URL and optional entity ID
- can generate a temporary test entity ID, so a canonical BrandProfile is not required for a dry-run

## Request

```json
{ "websiteUrl": "https://example.com" }
```

Optional:

```json
{ "websiteUrl": "https://example.com", "entityId": "known-test-brand-id" }
```

## Response

The successful response returns `mode=DRY_RUN`, `persisted=false`, execution ID, final execution state, processor results and validated Identity outputs.

## Developer mounting

`example_next_route.ts` illustrates how to mount the framework-neutral handler. It is intentionally not a real application route because this repository does not contain/confirm the application's auth/router implementation. The developer should use the existing backend conventions rather than introducing a second web stack.

## What remains outside Intelligence code before first live dry-run

Only the two existing-backend bindings need to be supplied:

1. `EvidenceRuntime` → existing Zyte/Cheerio implementation.
2. `AiProviderPort` → existing Gemini implementation.

The developer also instantiates the already-built loaders, Model Registry resolver, Prompt Builder adapter, Validator adapter and Telemetry adapter into one `IdentityRuntimeDependencies` object.

## Recommended first test

Use one clearly supported, uncomplicated brand website. Keep persistence false. Verify execution logs in this order:

1. execution starts
2. Gatekeeper Gemini-direct starts
3. evidence warm-up starts concurrently
4. Gatekeeper validates industry/sub-industry
5. Identity Core consumes normalized evidence and validates
6. Industry Niche, Reporting Currency and Market Geography run after dependencies
7. final validated Identity result returns
8. no BrandProfile mutation occurred

Then test one deliberately malformed provider fixture to prove validation blocks publication of bad output.
