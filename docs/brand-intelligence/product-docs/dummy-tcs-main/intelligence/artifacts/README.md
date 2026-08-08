# Intelligence Artifacts

Artifacts are reusable references assembled by the Intelligence Compiler for AI processor execution. They contain reasoning/instruction assets, not runtime evidence or canonical intelligence values.

## Global vs processor-specific

### Global artifacts
Use a global artifact only when the rule should behave identically across multiple processors/engines. Examples:
- evidence grounding and non-fabrication;
- source conflict handling principles;
- null/unknown behaviour;
- structured-output discipline;
- confidence/evidence traceability conventions where universally applicable.

Global artifacts must remain small. Do not move domain reasoning into a global file merely to reduce file count.

### Processor-specific artifacts
Use processor artifacts for capability-specific knowledge such as:
- reasoning procedure;
- domain taxonomy;
- processor-specific examples;
- output contract.

### Shared domain artifacts
If two or more processors genuinely require the same domain asset, promote that asset to a shared domain artifact rather than duplicate it. Promotion should follow demonstrated reuse, not anticipated reuse.

## Compiler assembly

For an AI processor, the compiler should resolve only applicable artifacts for the active output scope:

1. global execution/grounding rules;
2. processor reasoning;
3. required taxonomy/reference assets;
4. examples only where configured/useful;
5. runtime evidence/context;
6. active output contract.

Partial execution must not automatically load artifacts irrelevant to the requested outputs.
