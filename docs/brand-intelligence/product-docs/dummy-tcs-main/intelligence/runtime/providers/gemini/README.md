# Gemini Provider Adapter

Status: WORKING v0.1.

This adapter is the boundary between the provider-neutral Intelligence runtime and Google's Gemini SDK/API.

```text
Prompt Builder
  ↓ PromptPackage
Gemini adapter
  ↓ structured-output request
Gemini
  ↓ parsed/raw JSON
authoritative runtime validator
  ↓
validated Intelligence output OR structured failure
```

## Responsibilities

- translate the provider-neutral prompt package into a Gemini request;
- apply resolved model/runtime settings;
- support `normalized_evidence` and `website_direct` access modes;
- request structured output using the active output schema;
- collect usage/latency metadata;
- retry provider-transient failures only;
- parse returned JSON when the SDK does not return a parsed object;
- always run authoritative backend validation before returning success.

The adapter does not acquire Zyte evidence, choose processors/models, build prompts, persist Intelligence, or repair invalid model output.

## Current Google capability assumptions

The runtime should use a Gemini model that supports structured outputs. The provider schema adapter must translate our active machine schema to Gemini-supported JSON Schema. Backend validation remains authoritative because provider structured-output support is preventive, not a substitute for semantic validation.

`website_direct` is reserved for the Gatekeeper path. The concrete Gemini SDK implementation must enable the supported URL/direct website capability rather than routing this mode through Zyte/Cheerio.

## Model strategy for first Identity test

Keep stable runtime profiles (`fast_classification`, `grounded_extraction`, `grounded_geography`) even if multiple profiles initially resolve to the same concrete model. This lets model selection change later without changing processor definitions.

Before first execution, update `intelligence/runtime/models.yaml` with the concrete stable model IDs selected for the test and verify them through the provider model-list/get capability in the deployed environment.

## Still required for executable SDK integration

`GeminiClientPort` is intentionally an interface. The application/backend developer must wire the installed Google GenAI SDK/API client to `generateStructured()`, including:

- API-key/credential resolution from environment secrets;
- current Gemini structured-output request syntax;
- provider-compatible JSON Schema conversion;
- URL context/direct website access for Gatekeeper;
- usage metadata mapping;
- HTTP/provider error mapping.

Keeping this thin SDK wrapper separate prevents provider API changes from leaking into the Intelligence Compiler, Prompt Builder, processors, or artifacts.
