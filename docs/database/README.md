# Backend Database

The Prisma schema starts clean on purpose. Add models only as new v2 APIs are
implemented.

## Local Database

Start local Postgres:

```bash
docker compose up -d
```

Use this local URL:

```text
postgresql://postgres:password@localhost:5432/thecreatorshop?schema=public
```

## Prisma Commands

Generate the client:

```bash
npm run prisma:generate
```

Create and apply local migrations:

```bash
npm run db:migrate:dev
```

Apply existing migrations manually to a target database:

```bash
npm run db:migrate:deploy
```

## Dev Deploy Override

SST supports `DEV_DATABASE_URL` for the `dev` stage. This mirrors the old repo
pattern for pointing dev deployments at a separate RDS/t4g-style database.

Prod continues to use the SST Aurora resource connection unless that decision
is changed explicitly later.

## Domain notes

- `brand-discovery-and-users.md` — Step 1 discovery tables plus minimal
  `User` / `Organization` model and org-linkage rules.
