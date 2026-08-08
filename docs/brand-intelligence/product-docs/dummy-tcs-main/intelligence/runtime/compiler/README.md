# Intelligence Compiler / Orchestrator

Status: WORKING v0.1.

The Compiler is the runtime coordinator. It does not contain Intelligence reasoning.

For `identity_test` the effective flow is:

```text
website URL + entity
        ↓
identity_test profile
        ↓
Gatekeeper — Gemini website_direct
        ↓
industry + sub_industry validated
        ↓
Identity Core — normalized website evidence
        ↓
country + business identity validated
        ↓
┌──────────────────┬────────────────────┬─────────────────────┐
│ Industry Niche   │ Reporting Currency │ Market Geography    │
│ AI               │ deterministic      │ AI                  │
└──────────────────┴────────────────────┴─────────────────────┘
        ↓
validated Identity result
        ↓
optional canonical persistence (OFF for identity_test by default)
```

Evidence acquisition can begin before its consuming processor is runnable. For example Zyte/Cheerio acquisition can run while Gatekeeper is executing; the Compiler only gates the consuming processor on both its canonical dependencies and evidence readiness.

## Parallelism

The Compiler executes a dependency DAG. Independent READY tasks are run concurrently. This means parallelism is a property of the Execution Profile/dependency graph, not something embedded in processor reasoning.

In the current test profile, Industry Niche, Reporting Currency and Market Geography can run concurrently after Identity Core.

## Runtime integration interface

`compiler.ts` deliberately depends on `CompilerRuntime`. The application runtime implements two methods:

- `runAiTask()` — evidence resolution → Model Registry → Prompt Builder → Gemini adapter → validator → optional persistence.
- `runDeterministicTask()` — deterministic resolver → validation when applicable → optional persistence.

This keeps the DAG scheduler small and prevents it from becoming coupled to Gemini, Zyte, Prisma or a particular web framework.

## Trigger boundary

A website button/API route should not call Gemini or processors directly. It calls an application service such as:

```text
executeIntelligence({
  executionProfileId: "identity_test",
  entityType: "brand",
  entityId,
  websiteUrl,
  persistResults: false
})
```

That service loads the profile and invokes the Compiler.

The production onboarding trigger will later wrap the same Compiler with the already-defined scan reuse, abuse protection, existing-brand check, checkpoint/manual-edit and domain-verification lifecycle rules. Those rules should not be duplicated inside Identity processors.

## What remains before first real execution

The architecture is now connected conceptually and the DAG executor exists. Application adapters still need to bind the interfaces to the actual codebase:

1. execution-profile YAML loader
2. artifact/processor/object loaders
3. Identity evidence runtime (Zyte/Cheerio outputs)
4. Model Registry resolver
5. Prompt Builder invocation
6. Gemini SDK adapter
7. validator invocation
8. Prisma transaction adapter
9. Execution/ProcessorExecution telemetry persistence
10. API/service trigger

The first test should keep `persist_results=false`; this lets us verify real extraction, prompts, latency and validation before applying the six-field backend migration or writing canonical BrandProfile data.
