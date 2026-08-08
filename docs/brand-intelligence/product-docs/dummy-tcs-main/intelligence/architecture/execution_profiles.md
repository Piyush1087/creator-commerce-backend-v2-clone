# Execution Profiles

## Purpose

An Execution Profile defines **what should run together and how it should be orchestrated** for a platform use case.

It does not contain reasoning, evidence extraction logic or trigger ownership.

## Responsibilities

An execution profile may define:
- processors to execute;
- stages;
- parallel groups;
- current-run dependencies;
- execution depth;
- requested output scope;
- checkpoint boundaries;
- continuation conditions supplied by the calling workflow.

## Important distinction: dependency vs trigger

`depends_on` means that a processor/stage requires another processor/output **within the relevant execution graph**, not merely that an object exists from some historical execution.

Trigger ownership remains outside the compiler/profile. A profile is executed whenever the calling workflow asks for it.

## Full vs partial execution

Partial execution should reduce output scope and applicable context/artifacts without requiring a new processor for every subset of outputs.

Use a separate processor when the capability genuinely has different evidence, reasoning, runtime behaviour or independent execution needs—not simply because only one object is requested.

## Parallelism

Processors with no blocking current-run dependency can execute concurrently. `parallel` metadata describes orchestration intent; actual concurrency is implemented by workers/queue infrastructure.

## Checkpoints

A user checkpoint is a workflow boundary, not an AI trigger embedded in a processor. A single business workflow can therefore execute a profile/stage, pause for confirmation, and later continue with another stage/profile using the confirmed state.

## Example shape

```yaml
id: example_profile
entity_type: brand

stages:
  - id: stage_1
    processors:
      - processor_a
      - processor_b
    parallel: true

  - id: stage_2
    depends_on_current_run:
      - stage_1
    processors:
      - processor_c
```

The final profile metadata format will be frozen using the Brand Intelligence `Identity` reference implementation.
