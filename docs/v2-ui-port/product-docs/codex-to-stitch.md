I actually think this is the right moment to **change our mindset completely**.

We're no longer asking:

> "How do I use Codex?"

We're asking:

> **"How do I onboard a new AI engineer into Creator Shop?"**

Codex should be treated like a new senior frontend engineer joining the team.

That changes the sequence significantly.

---

# **Phase 0 — One-time Codex Project Setup (30–45 min)**

This happens **once**.

Never again.

## **Step 1 — Connect GitHub**

Already done.

Nothing else.

---

## **Step 2 — Give Codex its role**

First prompt should **not** be about Campaign.

It should be about Creator Shop.

I'd literally say:

You are joining Creator Shop as the Lead Frontend Engineer.

Your responsibility is not only to write code but to preserve the architectural integrity of the platform.

This repository is the canonical source of truth.

Never invent business logic when canonical contracts already exist.

Always inspect the repository before proposing changes.

Treat GitHub as authoritative.

Do not generate code in this conversation until instructed.

That's it.

Nothing technical.

This establishes the mindset.

---

# **Phase 1 — Repository Onboarding**

Now Codex learns.

Not codes.

Prompt

Review the repository structure.

Explain:

1\. Overall platform architecture  
2\. Major modules  
3\. Backend architecture  
4\. Frontend architecture  
5\. Design System location  
6\. Engineering Standards location  
7\. Campaign architecture  
8\. Any architectural inconsistencies you identify

Do not suggest improvements.

Do not generate code.

Only explain your understanding.

This verifies that it actually understands the repo.

---

# **Phase 2 — Campaign Onboarding**

Only now.

Prompt

Read every canonical Campaign document.

Your goal is to understand the Campaign module.

Explain back:

• Campaign lifecycle  
• Campaign page architecture  
• Component architecture  
• Backend ownership  
• Frontend ownership  
• State model  
• Operational workspaces

Do not generate code.

Do not redesign anything.

Only explain your understanding.

Notice

No file list.

Codex should find them.

---

# **Phase 3 — Stitch Orchestration**

This is where everything changes.

Instead of manually opening Stitch.

Prompt

Read

frontend/campaign/stitch/campaign\_shell.md

Execute this workflow.

Read every document referenced by that prompt.

Synthesize only the context Stitch requires.

Do not omit any business rule.

Then send the synthesized context to Stitch.

Wait for the generated design.

Return the design for review.

Do not implement code yet.

This is the entire magic.

---

# **Review**

We review.

Freeze.

---

# **Phase 4 — Discovery**

Exactly same.

Prompt

Execute

frontend/campaign/stitch/campaign\_discovery.md

Done.

---

# **Phase 5**

Applicants.

---

# **Phase 6**

Desktop.

---

# **Phase 7**

States.

---

# **After Design Freeze**

Only then

Implementation.

---

Prompt

Review the approved Stitch implementation.

Inspect the current frontend architecture.

Determine where every Campaign component should live.

Do not write code.

Produce an implementation plan that maps the approved UI to the existing repository.

This is much better than jumping into React.

---

# **Then**

Implementation.

---

Prompt

Implement Phase 1 from the implementation plan.

Do not implement future phases.

Commit only after all checks pass.

Notice

Small commits.

---

# **Why I don't think we need Design System onboarding anymore**

You're right.

Earlier I wanted to paste

Aurora

Engineering

etc.

Now

Codex has GitHub.

So instead we simply say

Inspect the Design System.

Use it.

Do not recreate it.

Much cleaner.

---

# **I also think we should stop giving file lists**

Instead of

Read

A

B

C

D

E

Just say

Execute

frontend/campaign/stitch/campaign\_shell.md

That prompt already points to the relevant context.

As long as we maintain those prompt files, they become the single entry point.

---

# **The workflow becomes**

You  
    │  
    ▼  
Codex

    Reads GitHub

    Executes Prompt

    Talks to Stitch

    Receives Design

    Returns for Review

    Commits

    ▼  
GitHub

You become

Product Owner.

Not context manager.

---

# **One thing I would add to every Codex conversation**

Right after onboarding, one sentence:

Whenever repository context is required, inspect the canonical documents yourself.

Do not ask me to paste documentation that already exists in GitHub.

If documentation conflicts, stop and report the conflict before proceeding.

I think this single instruction will save dozens of interruptions over the coming months.

---

# **My recommendation**

I would use **Codex as the primary engineering workspace from now on**.

The sequence becomes:

1. **One-time Codex onboarding** (platform \+ repository).  
2. **One-time Campaign onboarding**.  
3. **Execute the Stitch prompt files one by one** (Codex reads GitHub, orchestrates Stitch).  
4. **Review each generated design here**.  
5. **After design freeze, switch Codex into implementation mode** and build incrementally.

If Codex later proves weak in UI quality or orchestration, we can evaluate Antigravity. But I wouldn't introduce another tool until we've given Codex a fair chance using the architecture we've already built. I think there's a good chance it will be sufficient because your repository now contains far richer context than when we started.

