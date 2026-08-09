# Campaign Frontend — Create/Edit/View Module State Contract

**Status:** CANONICAL / PHASE 1C

This artifact supplements `campaign/frontend/state_map.md` with Create/Edit/View states that sit before or alongside the operational Campaign Page. It does not create new persisted Campaign statuses.

## 1. Create Campaign transient states

Create Campaign must support:

- new Draft initialization;
- resumed Draft;
- untouched field;
- focused/dirty field;
- field-exit validation success;
- field-exit validation error;
- autosave in-flight;
- autosave success;
- autosave recoverable failure while preserving local form state;
- Step 1 incomplete/invalid on Next;
- Step 2 incomplete/invalid on Next;
- Step 3 incomplete/invalid on Next;
- derived KPI resolving/ready/failure where exposed;
- optional archetype recommendation loading/ready/unavailable without blocking manual Campaign creation;
- publish in-flight;
- publish validation failure;
- publish system failure with Draft retained;
- publish success → Campaign Page Product Setup.

Untouched future fields must not show required-field errors solely because the step has loaded.

## 2. Edit Campaign states

Edit Campaign uses the same Campaign definition fields and supports:

- read/loading of current accepted values;
- editable field;
- locked field with presentation-safe reason where useful;
- field-exit validation;
- local dirty state;
- save/update in-flight;
- backend validation failure;
- lifecycle/capability conflict if editability changed concurrently;
- successful save followed by authoritative re-read;
- completed/archived view-only state.

Manual and AI-recommended Campaigns may render different editable-field sets because creation source is behaviorally authoritative.

## 3. Campaign Details/View states

Campaign Details is read-only and supports:

- drawer/detail loading;
- ready projection;
- recoverable read error/retry;
- not-found/permission-unavailable where applicable;
- Edit CTA enabled/disabled/hidden according to supplied capability;
- lifecycle actions only where supplied by the canonical Campaign capability projection.

Opening/closing the detail surface is frontend-local state and is not persisted.

## 4. Create → Page handoff

Manual Publish success produces canonical lifecycle `PUBLISHED` and transitions to Campaign Page.

Campaign Page then resolves its existing hydration state machine:

- no active Product → Product Setup;
- Product but no execution-ready Brief → Brief Setup;
- execution-ready Campaign → downstream runtime transition/operational state according to backend authority.

The Create Campaign frontend must not create a second setup state machine.

## 5. AI recommendation review states

AI-recommended Campaign acceptance may include:

- recommendation viewed;
- economics review;
- Product review/confirmation;
- Brief review/confirmation;
- final launch in-flight;
- validation/failure without partial Campaign creation;
- successful atomic launch → LIVE Campaign Page.

The recommendation review flow is not a persisted manual Campaign Draft.

## 6. Responsive rule

Create/Edit/View preserve identical field semantics, validation, editability and capabilities across desktop/mobile. Responsive changes may alter composition, progressive disclosure, drawer/full-screen presentation and control placement only.

## 7. Relationship to operational state map

`campaign/frontend/state_map.md` remains canonical for Campaign Page hydration/workspace/local states. This file adds module states for Create/Edit/View so the complete Campaign frontend journey can be implemented without treating Create Campaign as a separate product domain.