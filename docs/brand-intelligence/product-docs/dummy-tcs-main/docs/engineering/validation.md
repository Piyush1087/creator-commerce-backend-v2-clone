# VALIDATION_ENGINEERING_STANDARD.md

**Version:** 1.0  
**Status:** APPROVED

Supplements `AI_ENGINEERING_STANDARD.md`. This document owns executable validation architecture, primarily using Zod where applicable. Product/domain contracts remain the source of product truth.

## 1. Validation Context
Before modifying executable validation, inspect applicable product/domain contracts, existing Zod schemas, relevant TypeScript types, frontend/backend consumers, canonical enums/taxonomies and persistence implications where relevant.

## 2. Validation Layers
Validation may operate at field, object, cross-field, workflow and system-boundary levels. These concerns MAY share schemas but SHOULD remain conceptually distinguishable.

## 3. Canonical Schemas
Where repository architecture supports shared executable schemas, reuse them. Otherwise equivalent schemas MUST remain aligned with the same canonical product/domain contract.

Do not force shared runtime packages when repository architecture does not support them cleanly.

## 4. Zod
Use Zod for executable runtime validation where it is the established repository mechanism. Schemas SHOULD be explicit, understandable, composable where useful and aligned with canonical product rules.

Avoid unnecessarily complex schema metaprogramming that obscures business behavior.

## 5. Types from Schemas
Where appropriate, TypeScript types SHOULD derive from canonical Zod schemas rather than manually duplicate their shape. This does not imply every domain, persistence and transport representation must be identical.

## 6. Optional, Nullable & Empty
Treat missing/optional, explicit `null`, empty string and empty collection as distinct semantics unless an applicable contract defines equivalence.

## 7. Draft vs Completion Validation
Where applicable, distinguish **persistence validity** (can current state safely be saved?) from **operation/completion validity** (can it publish, submit, launch, approve or otherwise advance?).

Do not weaken completion rules because draft persistence is allowed, and do not impose completion rules during draft persistence unless required.

## 8. Cross-Field Rules
Rules involving multiple values SHOULD be expressed at the appropriate object/domain level rather than duplicated in UI event handlers. Examples include conditional requiredness, mutually exclusive fields, dependent values, date relationships and aggregate limits.

## 9. Canonical Enums & Taxonomies
Validation MUST consume or derive from canonical enum/taxonomy definitions where architecture permits. Do not create local string unions that silently diverge from canonical domain definitions.

Unknown external values SHOULD be rejected or explicitly mapped according to the relevant integration contract.

## 10. Frontend Consumption
Frontend validation exists primarily for user experience and early feedback. Use canonical executable rules where architecture permits. User-facing messages remain governed by approved UI copy where defined. Frontend success does not guarantee backend acceptance.

## 11. Backend Consumption
For client/server mutations, backend validation is authoritative. Untrusted request input SHOULD be validated before business operations rely on it and sufficiently close to the system boundary to prevent malformed data from flowing unnecessarily through application logic.

## 12. External & Imported Data
Treat external API responses, webhooks, imported files and equivalent external data as untrusted. Validate the portions relied upon by application behavior. Provider SDK types do not guarantee runtime correctness.

## 13. AI Output Validation
AI/model output used programmatically is untrusted. Prefer structured output contracts where downstream behavior depends on the result.

Validate before AI output can mutate domain state, create persisted entities, trigger downstream actions or become canonical application data. Invalid output follows failure/fallback behavior defined by the applicable AI/Intelligence contract.

## 14. Validation Errors
Validation errors SHOULD preserve enough structured information for consumers to identify the failing field/rule or operation. Application logic SHOULD NOT depend on parsing human-readable validation messages. User-facing wording and machine-readable semantics are separate concerns.

## 15. Normalization & Transformation
Validation and normalization SHOULD remain conceptually distinguishable. Safe boundary transformations MAY be performed where contractually defined. Do not silently transform values in ways that change product meaning.

## 16. Validation Verification
In addition to the universal Definition of Done, verify where applicable:
- schemas align with canonical product/domain rules;
- valid cases pass and invalid cases fail;
- boundary values are covered;
- cross-field invariants are covered;
- draft/completion thresholds behave correctly;
- canonical enums/taxonomies are not duplicated;
- frontend/backend consumption remains consistent;
- malformed external/AI input is rejected appropriately.

Only report checks actually performed.