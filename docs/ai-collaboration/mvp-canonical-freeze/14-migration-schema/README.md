# Prisma lives in this repository

Canonical schema: `prisma/schema.prisma`  
Migrations: `prisma/migrations/` (87 folders, head `20260910122000_c03_application_handoff_notifications`)

Program register: `migration-and-schema-register.md` in this folder.  
Leftover / OUT tables (re-mark every amendment): `retained-schema-register.md`.

```text
npx prisma validate   # PASS 2026-09-08
npx prisma migrate deploy   # 0→head NOT YET PROVEN on disposable DB
```
