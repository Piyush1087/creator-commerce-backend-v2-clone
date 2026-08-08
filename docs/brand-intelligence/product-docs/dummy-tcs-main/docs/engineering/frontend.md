# FRONTEND_ENGINEERING_STANDARD.md

**Version:** 1.0  
**Status:** APPROVED

Supplements `AI_ENGINEERING_STANDARD.md`. This document owns frontend-specific engineering requirements.

## 1. Frontend Context
Before material frontend work, inspect relevant application shell/layout, routing, feature/module structure, shared components, executable Design System, state/data-access patterns and frontend types/contracts. For visual work, also use applicable Aurora, approved copy and approved Stitch/reference sources.

## 2. Feature & Component Architecture
Feature-specific behavior SHOULD remain with its owning feature/module. Follow established repository organization.

Components SHOULD have coherent responsibilities. Extract logic/subcomponents when it improves comprehension, reuse, testability or separation of independent responsibilities. Line count alone is not a decomposition rule.

Avoid premature generic component factories, form engines, page engines or configuration abstractions.

Before creating a common UI primitive, inspect executable Aurora/Design System components, application shared components and relevant feature components. Feature-specific patterns SHOULD remain feature-specific until genuine reusable Design System behavior emerges.

## 3. State Ownership
Distinguish where applicable local interaction, form, server, URL/navigation, workflow and application-global state. State SHOULD live at the lowest appropriate owner capable of coordinating consumers. Reliably derivable values SHOULD generally be derived rather than independently stored.

Frontend presentation state MAY derive from canonical domain state but MUST NOT redefine the domain lifecycle.

## 4. Multi-State UI
Related states of one product surface SHOULD normally use one canonical implementation rather than cloned pages.

Before expanding approved reference states, identify invariant structure and domain-, data-, interaction- and permission-dependent elements. Relevant state categories may include lifecycle/domain, data, async, failure, permission and interaction.

Use the simplest representation that keeps behavior understandable. A state-machine library is not required merely because multiple states exist.

## 5. Loading, Empty, Error & Mutation UX
Loading SHOULD preserve useful structure where practical and follow Aurora behavior where defined.

Empty data is not automatically an error; empty states SHOULD represent the actual product condition and preserve applicable actions.

Where meaningful, distinguish page/data-load, section-level, field-validation and mutation failures. A local dependency failure SHOULD NOT unnecessarily disable an otherwise usable surface when partial recovery is supported.

Mutations SHOULD account for applicable pending, success, failure and recovery behavior. Client duplicate prevention improves UX but does not replace backend duplicate safety.

## 6. Forms & Validation UX
Executable validation architecture is governed by `docs/engineering/validation.md`. Frontend validation SHOULD provide timely feedback and avoid obviously invalid requests.

Preserve the distinction, where applicable, between valid enough to save and complete enough to advance/publish. Approved UI copy governs user-facing validation messaging where defined.

## 7. Routing & Navigation
Use established application routing architecture. Inspect route configuration, nested layouts, authentication boundaries and URL conventions before modifying routes.

State benefiting from deep linking, refresh persistence, sharing or browser history MAY belong in the URL; ephemeral interaction state generally should not.

Where applicable, routed screens SHOULD work when opened directly or refreshed rather than unnecessarily depending on transient previous-screen state.

## 8. Aurora Implementation
Aurora is canonical for reusable visual-system behavior. Use the repository's executable Aurora implementation where available.

Do not locally recreate existing Aurora tokens, typography, spacing, radii, common primitives or component behavior.

If a feature requires a pattern not represented in Aurora, implement the smallest appropriate feature-level solution. Design System promotion is a separate decision.

If canonical Aurora documentation and executable implementation materially disagree, follow the authority rule in the universal standard and surface unresolved discrepancies.

## 9. Stitch / Approved Reference
Approved Stitch/reference screens govern applicable screen-level composition and visual intent. Preserve information hierarchy, composition, section arrangement, relative proportions, intended density and visual relationships.

Stitch-generated implementation MUST be reconciled with production architecture, Aurora, shared components, state architecture, accessibility and approved copy.

Generated code MAY be refactored to remove duplicated styling, hard-coded Design System values, monolithic structure, placeholder data architecture, unnecessary dependencies and duplicated primitives. Refactoring SHOULD preserve approved composition and visual intent unless a higher-authority requirement conflicts.

Once representative states establish sufficient visual language, ordinary lifecycle/data/loading/error/permission variations SHOULD generally be implemented directly in the canonical frontend. Return to Stitch when a materially unresolved visual/compositional problem remains.

## 10. Responsive Engineering
Implement applicable Aurora and approved-design responsive behavior. Responsive implementation SHOULD reflect intended interaction rather than merely shrink desktop dimensions.

Critical product functionality SHOULD remain available across supported viewport classes unless explicitly specified otherwise. Account for realistic variable content and avoid unintended viewport overflow.

Material frontend surfaces SHOULD be verified across applicable supported viewport classes.

## 11. UI Copy
Approved UI copy MUST be reproduced faithfully. Do not creatively rewrite canonical labels, headings, helper text, CTAs, validation messages, disclaimers or empty-state content.

Stitch/reference text is not automatically canonical. When final copy is unavailable, explicitly identified development placeholders MAY be used where they do not create product ambiguity.

Dynamic implementation SHOULD accommodate realistic names, counts, amounts, currencies, dates and statuses without altering canonical meaning.

## 12. Accessibility
Use semantic HTML and established accessible interaction patterns. Where applicable use buttons for actions, links for navigation, labels for inputs, accessible names for icon-only controls, keyboard-operable interactions, appropriate modal/drawer focus behavior and non-color cues for critical meaning.

Aurora-specific accessibility requirements remain authoritative where defined.

## 13. Frontend Performance
Avoid clearly unnecessary repeated requests, duplicated server state, expensive recomputation, avoidable rerender chains and excessive data loading.

Do not introduce memoization, virtualization, caching or similar complexity mechanically. Use scale-oriented techniques when actual or reasonably expected usage justifies them.

## 14. Frontend Verification
In addition to the universal Definition of Done, verify where applicable:
- required UI states;
- Aurora/reference fidelity;
- canonical copy;
- responsive behavior;
- accessibility;
- forms and mutation behavior;
- routing/deep-link behavior;
- relevant frontend tests/build/type checks.

Only report checks actually performed.

## 15. Canonical path
Use `docs/design-system/AURORA_DESIGN_SYSTEM.md` as the canonical Aurora Design System path in repository references and prompts.