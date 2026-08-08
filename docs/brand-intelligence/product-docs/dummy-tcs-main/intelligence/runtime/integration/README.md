# Identity Runtime Integration

Status: WORKING v0.1.

This layer connects the generic Intelligence Compiler to application/runtime capabilities without putting Gemini, Zyte, Prisma or web-framework code inside the Compiler.

## Runtime path

```text
UI button / API route
        ↓
IntelligenceService.execute(identity_test)
        ↓
Identity Runtime
        ↓
Execution Profile Loader
        ↓
Compiler DAG
        ↓
AI task:
  definitions/artifacts + evidence + model resolution
        ↓
  Prompt Builder
        ↓
  Gemini Provider
        ↓
  Validator
        ↓
  Persistence (dry-run by default)
        ↓
Execution result + telemetry
```

## Files

- `types.ts` — ports/interfaces for application adapters.
- `identity_runtime.ts` — binds Compiler AI/deterministic task execution into one Identity runtime.
- `service.ts` — application-facing execution service; future API/button handlers call this rather than processors directly.

## Evidence concurrency

`executeIdentityTest()` starts `prepareIdentityEvidence()` immediately and does not block Gatekeeper on it. This preserves the intended MVP optimization:

```text
                 ┌─ Gatekeeper / Gemini direct ─┐
website submitted┤                              ├─ downstream Identity
                 └─ Zyte/Cheerio evidence ─────┘
```

The consuming processor still calls `getEvidence()` and must receive its required evidence before its model call.

## Ports still requiring concrete app adapters

The integration layer intentionally defines ports rather than guessing the existing application implementation. The developer needs to bind:

- `ExecutionProfileLoader` → repository/config loader for YAML profiles.
- `DefinitionLoader` → frozen processor/artifact/object YAML loader.
- `EvidenceRuntime` → existing/new Zyte + Cheerio extraction runtime and evidence store.
- `ModelRuntimeResolver` → `runtime/models.yaml` resolver.
- `PromptBuilderPort` → `prompt_builder.ts`.
- `AiProviderPort` → Gemini adapter/SDK.
- `OutputValidatorPort` → `validation/validator.ts`.
- `PersistencePort` → Prisma adapter using `identity_mapping.yaml`.
- `TelemetryPort` → execution/processor-execution persistence/logging.

## Important implementation note

The current integration skeleton uses a placeholder string (`runtime_execution`) when creating processor telemetry because the generic `CompilerRuntime` interface does not yet pass the actual execution ID into each task invocation. Before production implementation, thread the real `executionId` through Compiler task context. This is a small runtime-contract correction, not an architecture change.

## Trigger

The frontend/API should eventually call one backend application route which invokes:

```ts
intelligenceService.execute({
  executionProfileId: "identity_test",
  entityType: "brand",
  entityId,
  websiteUrl,
  persistResults: false,
});
```

For production onboarding, the route/service first applies scan admission rules (existing verified brand, 7-day reuse, abuse/domain-verification safeguards), then invokes the appropriate onboarding Execution Profile. Those rules remain outside the Compiler and processors.

## First runnable milestone

Do not enable canonical writes yet. The first milestone is a real `identity_test` dry run that proves:

1. Gatekeeper direct Gemini call works.
2. Zyte/Cheerio evidence warms concurrently.
3. Identity Core receives normalized evidence.
4. Prompt Builder composes the expected package.
5. Gemini 3.5 Flash returns structured output.
6. Zod + semantic validation passes/fails correctly.
7. Industry Niche, Reporting Currency and Market Geography dispatch according to dependencies.
8. Execution/processor telemetry shows latency, model, artifacts, evidence refs and validation status.
9. Final validated Identity result is returned without writing BrandProfile.
