# Intelligence Prompt Builder

Status: WORKING v0.1 — implemented as the first provider-neutral runtime component for `identity_test`.

## Job

The Prompt Builder receives one AI task that the Intelligence Compiler has already decided to execute and builds the exact provider-neutral prompt package for that task.

It does **not** orchestrate the Intelligence Engine.

```text
Compiler selects task
        ↓
loads processor + artifacts + objects + evidence + dependencies
        ↓
resolves model runtime
        ↓
PROMPT BUILDER
        ↓
provider-neutral PromptPackage
        ↓
Gemini/provider adapter
        ↓
model response
        ↓
output validator
```

## Files

- `contract.yaml` — normative MVP contract.
- `prompt_builder.ts` — reference TypeScript implementation of the contract.

## Prompt composition

The builder composes, in order:

1. global runtime boundary
2. global evidence grounding
3. global output discipline
4. processor task/purpose
5. processor reasoning
6. processor taxonomy/rules when applicable
7. active Intelligence Object definitions only
8. canonical dependencies when applicable
9. relevant evidence
10. active structured output contract

The output contract is returned separately as `structured_output_schema` so the provider adapter can use native structured-output/schema capabilities rather than relying only on prose instructions.

## Partial execution

A processor can own many outputs without forcing every output into every model call. The builder receives `active_outputs`, filters Intelligence Object definitions and marks the output contract for that scope. Shared reasoning/taxonomy and required dependencies/evidence are still included when needed.

Example:

```text
identity_core
owns 12 outputs

partial request:
active_outputs = [brand_logo]

Prompt Builder includes:
- Identity Core reasoning needed for logo selection
- brand_logo object definition
- relevant logo evidence
- brand_logo output schema

It does not ask the model to regenerate country, tagline, social handles, etc.
```

## Important implementation boundary still open

`prompt_builder.ts` intentionally does not pretend that YAML output contracts are already executable JSON Schema/Zod schemas. `activeOutputSchema()` currently returns the source contract plus active-output filtering metadata.

Before the first real Gemini execution, we need a **machine output-contract adapter/validator** that can:

```text
YAML output contract
      ↓
active processor scope
      ↓
executable schema (recommended: Zod as backend runtime schema)
      ↓
provider-compatible structured-output schema
      +
post-response validation
```

This avoids maintaining two independently authored definitions of the same output contract.

## Traceability

Every PromptPackage carries:

- Prompt Builder version
- global artifact versions
- processor artifact versions
- active output IDs
- Intelligence Object definition versions
- evidence refs/run IDs
- output-contract version
- model profile/access mode

Runtime should also store a hash of the provider-neutral PromptPackage on the Processor Execution record.

## Next runtime dependency

The Prompt Builder is now sufficiently defined to build against. The next missing executable component for `identity_test` is the **machine output contract / validation layer** (including conversion of our frozen YAML contracts into executable schemas). After that, the Compiler can safely make a real model call without risking unvalidated Intelligence persistence.
