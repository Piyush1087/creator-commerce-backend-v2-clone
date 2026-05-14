# Backend Structure And Naming Directives

This document defines how backend modules, APIs, and schema work should be
organized.

## Module Naming

Use kebab-case folders and file names:

```text
src/features/brand-profile/brand-profile.module.ts
src/features/brand-profile/brand-profile.controller.ts
src/features/brand-profile/brand-profile.service.ts
```

Use PascalCase classes:

```ts
BrandProfileModule
BrandProfileController
BrandProfileService
```

Use explicit DTO names:

```text
create-brand-profile.dto.ts
update-brand-profile.dto.ts
brand-profile-response.dto.ts
```

## API Ownership

Every API belongs to one feature module. Do not add unrelated endpoints to a
shared controller.

Controllers:

- define routes
- validate request DTOs
- call services
- return response DTOs

Services:

- own business logic
- call Prisma
- coordinate feature-specific workflows

## Prisma Ownership

Prisma models should reflect the clean v2 domain. Do not import old schema
names simply because old code used them.

Before adding a model:

1. Write the feature/API use case.
2. Decide which service owns the model.
3. Define the minimum fields needed now.
4. Add relations only when a current API requires them.
5. Document the migration in `docs/database`.

## Validation

Use DTO classes and Nest validation for HTTP inputs. If a feature needs shared
runtime validation with frontend later, document the intended schema contract in
the feature docs before duplicating logic.

## Environment

Keep env minimal.

Current baseline:

- `PORT`
- `STAGE`
- `DATABASE_URL`
- `DEV_DATABASE_URL`

New env vars must be documented in `.env.example` and the relevant docs folder.

## Review Before Merge

- Does the module have one clear owner?
- Are controllers thin?
- Are services testable without HTTP?
- Are DTO names clear?
- Are Prisma changes minimal?
- Is migration execution manual and documented?
- Do build and lint pass?
