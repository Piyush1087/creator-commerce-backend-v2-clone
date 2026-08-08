# AGENTS.md

**Version:** 1.0  
**Status:** APPROVED

**Purpose:** Context router for AI engineering agents working in this repository.

This file tells agents **what to read**. It does not define product behavior or duplicate engineering rules.

> Paths in this routing document identify canonical documentation locations in this repository; they do not prescribe application source-code directory structure.

## 1. Always Read

For material engineering work, read:

1. `AI_ENGINEERING_STANDARD.md`
2. applicable product/module contracts
3. relevant existing implementation
4. only the specialist standards and supporting sources that can materially affect the task

Do not load documentation merely because it exists. Use the **minimum sufficient authoritative context** required for correct implementation.

Authority and conflict resolution are defined in `AI_ENGINEERING_STANDARD.md`.

## 2. Context Routing

### Frontend / UI

Read:
- `docs/engineering/frontend.md`
- applicable product/module contracts
- approved UI copy
- relevant existing frontend implementation

Also read when applicable:
- Aurora Design System
- approved Stitch/UI reference

Do not automatically load database or AI/Intelligence internals.

### Stitch → Production Frontend

Read:
- `docs/engineering/frontend.md`
- applicable product/module contracts
- approved UI copy
- Aurora Design System
- approved Stitch/reference
- relevant existing frontend implementation

Treat Stitch-generated code as implementation input, not production architecture.

### Backend

Read:
- `docs/engineering/backend.md`
- applicable product/module contracts
- relevant existing backend implementation

Also read when applicable:
- `docs/engineering/validation.md` for executable validation changes
- `docs/engineering/database.md` for persistence/schema changes
- `docs/engineering/ai-integration.md` for AI/Intelligence interactions

### Database / Prisma

Read:
- `docs/engineering/database.md`
- applicable domain contracts
- relevant existing schema/Prisma implementation

Load `docs/engineering/validation.md` when executable domain contracts are also affected.

### Validation / Zod

Read:
- `docs/engineering/validation.md`
- applicable canonical product/domain contracts
- relevant existing schemas/types

### AI / Intelligence / Prompts

Read:
- `docs/engineering/ai-integration.md`
- applicable Intelligence contracts
- relevant domain/module contracts

Load applicable Prompt Builder specifications when prompt construction or model interaction is affected.

## 3. Cross-Layer Work

When a task spans multiple layers, load specialist standards only for layers being materially changed.

Identify:
- what owns the behavior;
- what owns the data;
- what owns validation;
- what owns derived Intelligence;
- which contracts connect the layers.

Do not load every specialist standard merely because the product contains those layers.

## 4. Module Specifications

Module/product specifications define **what to build**.

Engineering standards define **how to build it**.

Aurora defines reusable visual-system behavior.

Approved Stitch/reference designs define applicable screen composition.

Existing implementation shows how the current system is built.

Use the authority model in `AI_ENGINEERING_STANDARD.md` when these differ.

## 5. Context Principle

The objective is not maximum context. The objective is:

> **Minimum sufficient authoritative context for correct implementation.**

Before loading another source, ask:

> Could this source materially change the implementation decision?

If not, do not load it.

Follow all change discipline, autonomy, governance protection, verification and Definition of Done requirements in `AI_ENGINEERING_STANDARD.md`.