# Global LLM Artifacts

Status: WORKING — minimal MVP set for Identity runtime validation.

These artifacts contain only instructions that are genuinely common to Intelligence AI processors. They are loaded by the Prompt Builder before processor-specific artifacts.

## Current minimal set

1. `runtime_context.yaml`
   - Defines the model's execution boundary.
   - Keeps orchestration, persistence, locking, retries and profile routing outside the LLM.

2. `evidence_grounding.yaml`
   - Requires brand-specific Intelligence to be grounded in supplied runtime evidence.
   - Defines the global null-over-guess behavior.
   - Leaves evidence precedence and processor-specific inference rules to processor artifacts.

3. `output_discipline.yaml`
   - Requires output only for the active scope and exact active output contract.
   - Prevents extra prose, inactive outputs, invented values and enum drift.

## Deliberately not separate global artifacts for MVP

### `null_and_uncertainty.yaml`
Not created. Its genuinely global rule is small and is already contained in `evidence_grounding.yaml` and `output_discipline.yaml`. Processor-specific null semantics remain in processor output/reasoning contracts.

### `source_conflict_policy.yaml`
Not created. A universal source-precedence order would be unsafe: Identity Core, Industry Classification and Market Geography use evidence differently. The global grounding artifact says not to ignore conflicts; the processor-specific reasoning artifacts decide how to resolve them.

### `reasoning.yaml`
Not global. Reasoning is processor-specific by design.

### `taxonomy.yaml`
Not global unless a taxonomy is genuinely reused across processors/branches. Industry taxonomy remains with Industry Classification for now.

### `safety.yaml`
Not created as a separate Intelligence artifact at this stage. Provider/application safety and authorization are runtime/platform responsibilities unless a future Intelligence use case requires processor-visible safety instructions.

## Prompt Builder order for Identity

Conceptually:

```text
runtime system instruction
  +
global/runtime_context
  +
global/evidence_grounding
  +
global/output_discipline
  +
processor purpose/definition
  +
processor-specific reasoning
  +
processor-specific taxonomy/rules where applicable
  +
active Intelligence Object definitions
  +
active output contract
  +
canonical dependencies
  +
evidence
```

The exact serialization/order will be frozen in the Prompt Builder contract. The important boundary is that global artifacts must not duplicate or override processor-specific business reasoning.

## MVP documentation principle

Create a new global artifact only when the same meaningful instruction is needed across multiple processors and keeping it processor-specific would cause real duplication or consistency risk. Do not create global files merely to mirror a theoretical architecture.
