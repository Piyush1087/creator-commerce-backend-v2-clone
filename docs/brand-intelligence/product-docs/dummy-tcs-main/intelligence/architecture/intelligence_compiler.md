# Intelligence Compiler

## Purpose

The Intelligence Compiler is the common runtime orchestrator that converts an execution request into one or more executable processor jobs.

It should not contain branch-specific reasoning. Intelligence behaviour lives in metadata and artifacts.

## Core responsibility

```text
Execution Request
  ↓
Resolve Execution Profile / Requested Scope
  ↓
Resolve Processors
  ↓
Preflight
  ↓
Resolve Intelligence Objects
  ↓
Resolve Artifacts
  ↓
Build Context
  ↓
Build Executable Request
  ↓
Dispatch Executor
  ↓
Validate Output
  ↓
Persist Canonical Intelligence + State/History
  ↓
Write Processor Execution Telemetry
```

## Execution request

A request identifies at minimum:
- entity type;
- entity id;
- execution profile or processor(s)/output scope;
- runtime execution context.

The compiler does **not** decide why or when it was called. Manual actions, onboarding, refresh schedules, evidence-change events and other triggers belong outside the compiler.

## Preflight

Before an executor is called, the compiler verifies that execution is possible. Checks include:
- processor exists;
- requested output objects exist and belong to the processor scope;
- required evidence/intelligence inputs exist;
- required artifacts resolve;
- output contract resolves;
- executor/runtime configuration exists;
- dependencies for the current execution are satisfied.

Missing optional/recommended evidence does not block execution.

## Context Builder

The Context Builder assembles runtime information from processor input requirements, available evidence, existing intelligence and object state.

It should not contain intelligence-specific conditional logic. Processor metadata declares what context is required.

Protected or permanently locked objects should be removed from executable output scope before an AI call where possible, preventing unnecessary token usage.

## Prompt Builder

For AI processors, the Prompt Builder assembles:
1. global/shared instructions;
2. processor task;
3. applicable reasoning;
4. taxonomies/reference material where required;
5. examples where required;
6. runtime context/evidence;
7. active output scope;
8. structured output contract.

Artifacts should support scope filtering so partial execution does not send irrelevant reasoning or output fields.

## Executors

The compiler dispatches work according to processor/execution metadata:
- **AI Executor** — structured LLM execution;
- **Rule Executor** — deterministic business rules;
- **Formula Executor** — deterministic calculations;
- future executor types may be added without changing intelligence ownership.

Model/provider selection is runtime configuration, not embedded intelligence reasoning.

## Parallel execution

Independent processors may be dispatched concurrently by workers. The compiler owns the execution graph; worker/queue infrastructure is an implementation concern and does not require a processor-specific registry.

## Output validation

Before persistence, validate:
- structural/schema compliance;
- requested output scope;
- taxonomy/domain constraints;
- object-level write/lock protection.

Retry only failures that can reasonably succeed on another attempt. Missing prerequisites should fail before the model/executor is called.

## Persistence

Validated values are written to their canonical application-schema destination. Intelligence State/History stores additional provenance/lifecycle metadata where needed. Every execution writes Processor Execution telemetry for observability, cost analysis and debugging.
