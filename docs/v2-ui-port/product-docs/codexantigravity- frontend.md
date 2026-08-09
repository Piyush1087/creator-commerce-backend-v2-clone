I actually think we should go **one step further**.

After spending months building Creator Shop together, I think we should stop thinking about:

> "How do I prompt Stitch?"

Instead, we should think:

> **"How do I onboard a new AI engineer into Creator Shop?"**

That mindset produces much better results.

---

# **I would create an entire AI Agent workspace inside GitHub**

creator-shop/

docs/

campaign/

intelligence/

frontend/

ai\_agents/

    stitch/

    codex/

    antigravity/

This becomes a permanent asset.

---

# **ai\_agents/**

ai\_agents/

    README.md

    stitch/

    codex/

    antigravity/

---

# **README.md**

This explains

Creator Shop is built AI-first.

Every AI agent joining the project must first  
understand the platform before generating code.

Each AI tool has a dedicated onboarding guide.

Never skip onboarding.

Never generate code before understanding  
the business architecture.

---

# **Stitch Folder**

stitch/

01\_platform\_onboarding.md

02\_campaign\_onboarding.md

03\_design\_tasks.md

04\_review\_tasks.md

05\_generation\_checklist.md

---

## **01 Platform Onboarding**

Very short.

Contains

Mission

Design Philosophy

Aurora

Interaction Philosophy

Engineering Philosophy

Nothing Campaign specific.

---

Feed

docs/design-system

docs/engineering

---

## **02 Campaign Onboarding**

Contains

Campaign Design Spec

Component Inventory

Content Dictionary

Implementation Plan

Goal

Understand.

No UI.

---

## **03 Design Tasks**

This becomes a reusable prompt library.

---

Example

Task 01

Generate Campaign Shell

---

Task 02

Generate Discovery

---

Task 03

Generate Applicants

---

Task 04

Desktop

---

Task 05

Remaining States

Every task

↓

one prompt.

---

## **04 Review Tasks**

This is missing from almost every AI workflow.

Instead of asking

Design this.

We ask

Audit your own design.

List:

Accessibility issues

Hierarchy issues

Spacing issues

Component duplication

Violations of Aurora

Violations of Design Spec

This dramatically improves quality.

---

## **05 Generation Checklist**

Before Stitch finishes

It checks

✓ Drawer philosophy followed

✓ One workspace expanded

✓ Internal scrolling

✓ Typography hierarchy

✓ Aurora components only

✓ Mobile IA

✓ Responsive

✓ No duplicated information

✓ Component reuse

✓ Design spec followed

---

# **Codex Folder**

Very different.

codex/

01\_context.md

02\_build\_order.md

03\_backend\_connection.md

04\_review.md

05\_merge\_checklist.md

---

Codex shouldn't think about

Design.

It should think

Implementation.

---

# **Antigravity**

Almost identical.

---

# **Now comes the biggest improvement.**

## **Prompt Templates**

Instead of writing prompts every time,

we create

prompt\_templates/

---

prompt\_templates/

learn.md

generate.md

review.md

refactor.md

implement.md

audit.md

Now

every module

uses identical prompts.

---

Example

learn.md

Read all supplied documentation.

Do not generate anything.

Return:

Business understanding

Architecture understanding

Interaction understanding

Questions

Potential conflicts

Every AI starts here.

---

generate.md

Using the supplied documentation,

generate only the requested module.

Never redesign architecture.

Never invent interactions.

Reuse existing components.

List assumptions.

---

review.md

Review your own output.

Check against:

Design Spec

Component Inventory

Content Dictionary

Aurora

Engineering Rules

List every violation.

---

audit.md

Compare generated output against GitHub.

Identify

Missing components

Duplicate components

Interaction inconsistencies

Visual inconsistencies

Engineering inconsistencies

---

# **The final workflow**

This is what I would put in GitHub.

Business Contracts  
        │  
        ▼  
Design System  
        │  
        ▼  
Engineering Standards  
        │  
        ▼  
Campaign Design Spec  
        │  
        ▼  
Component Inventory  
        │  
        ▼  
Content Dictionary  
        │  
        ▼  
Implementation Plan  
        │  
        ▼  
AI Agent Onboarding  
        │  
        ▼  
Prompt Templates  
        │  
        ▼  
Stitch  
        │  
        ▼  
Design Review  
        │  
        ▼  
Codex  
        │  
        ▼  
React  
        │  
        ▼  
Backend Integration  
        │  
        ▼  
Developer Review

---

# **One thing I would change in your overall repository**

This is probably the most important recommendation I'll make.

Today, your documentation is organized by **document type**:

docs/

campaign/

engineering/

I would reorganize it by **AI consumption order**.

For example:

ai\_context/

00\_platform/  
    design\_system.md  
    engineering/

10\_campaign/  
    design\_spec.md  
    content\_dictionary.md  
    component\_inventory.md  
    implementation\_plan.md

20\_backend/  
    prisma/  
    zod/  
    lifecycle/

30\_agents/  
    stitch/  
    codex/  
    antigravity/

40\_prompts/

This structure mirrors how an AI agent learns:

1. **Understand the platform.**  
2. **Understand the module.**  
3. **Understand the implementation contracts.**  
4. **Execute a task.**

Instead of hunting across unrelated folders, every AI agent follows the same learning path. I believe this will improve the consistency of Stitch, Codex, Antigravity, and even future AI tools far more than adding another design document, because it optimizes **how context is consumed**, not just what context exists.

