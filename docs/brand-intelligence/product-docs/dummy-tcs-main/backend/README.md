# Creator Shop Backend Reference

Status: CANONICAL NAVIGATION

This directory contains backend implementation/reference artifacts for Creator Shop domains currently being designed in this repository. It is no longer Intelligence-only.

## Canonical Campaign implementation

- `campaign_schema.prisma` — current Campaign persistence working view (v1.9).
- `validation/**` — executable Campaign request/domain-boundary Zod schemas.
- `../campaign/backend/implementation_map.md` — canonical Campaign service, lifecycle, transaction, concurrency, orchestration and integration map.
- `../campaign/README.md` — Campaign module entry point and authority order.

For Campaign implementation, these layers take precedence over historical `*_schema_reconciliation.*` artifacts.

## Intelligence persistence

- `intelligence_schema.prisma` — focused Intelligence persistence working view.

Detailed Intelligence processor execution, retry/failure telemetry, reusable intelligence state/history and artifact lineage remain Intelligence-owned. Campaign must not duplicate those concerns merely to make Campaign persistence self-contained.

## Focused domain contracts

This directory also contains frozen contracts for Campaign-adjacent modules such as Discovery, Outreach, Applicants, Reporting and Share. These remain useful detailed domain/runtime specifications where they do not conflict with the higher-authority Campaign Prisma, executable Zod schemas or Campaign implementation map.

## Reconciliation artifacts

Files named `*_schema_reconciliation.*`, files under `backend/reconciliation/`, and equivalent Campaign reconciliation artifacts record how canonical schemas were reached. They are **SUPERSEDED FOR IMPLEMENTATION** once their decisions are represented in the current canonical layers.

Keep them for traceability unless a later cleanup explicitly removes them; do not implement directly from them without checking current canonical artifacts.

## Developer workflow

This repository is an implementation/reference repository, not automatically the production application's Prisma source of truth.

When integrating into the production application:

1. read the relevant module entry point and canonical implementation map;
2. reconcile the working Prisma/Zod artifacts with the production backend architecture;
3. preserve frozen domain semantics and ownership boundaries;
4. use normal reviewed migrations rather than mechanically replacing production schema files;
5. do not create duplicate stores for values already canonically owned by Campaign, Intelligence, Brand or Collaboration.
