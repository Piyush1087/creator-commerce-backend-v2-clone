# Intelligence Runtime Telemetry

P0 #6 status: CLOSED for the first `identity_test` dry-run.

Telemetry is an observability layer. It does not influence processor reasoning, validation or canonical output.

## Records

Two record types are emitted:

### Execution
One record for the whole Execution Profile run: execution/profile/entity IDs, URL, persistence mode, start/end, duration and final state.

### ProcessorExecution
One record per task: processor/scope/kind/outputs, timing/state, resolved model, prompt build ID, evidence refs, artifact versions, provider latency/usage, validation failure, error and whether persistence was skipped.

## First dry-run sink

`StructuredLogTelemetrySink` writes JSON structured server logs. This deliberately avoids blocking the first dry-run on a new database schema.

The developer can later implement `TelemetrySink` with Prisma/another store without changing Compiler, processors or Execution Profiles.

## Binding

```ts
const telemetry = new IntelligenceTelemetryAdapter(new StructuredLogTelemetrySink());
```

Pass `telemetry` into `IdentityRuntimeDependencies`.

## Provider handoff

The existing Gemini adapter should return metadata when available using these preferred keys:

```ts
{
  provider_latency_ms,
  usage: { input_tokens, output_tokens }
}
```

The runtime itself adds model profile/model ID/provider, prompt build ID, evidence refs, artifact versions and persistence mode. Provider token metadata is optional for the first dry-run if the existing SDK does not expose it cleanly.

## Persistence policy

For `identity_test`, telemetry may be persisted/logged while Intelligence results remain `persistResults=false`. Observability is not a canonical BrandProfile write.

## Privacy/logging rule

Do not log full prompts, raw HTML, API credentials, or complete evidence content in telemetry. Store stable IDs/refs and versions. Debug content logging, if ever enabled, must be separately controlled and non-production by default.

## Future DB sink

A DB-backed sink is P1/operational hardening, not a blocker for the first dry-run. Recommended tables/entities are `IntelligenceExecution` and `ProcessorExecution`; exact Prisma fields should be reconciled with the deployed backend schema before migration.
