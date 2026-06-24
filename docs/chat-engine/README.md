# Chat Engine — engineering docs index

Product reference (read-only): [`product-docs/`](./product-docs/) — **do not edit**.

---

## Folder layout

| Folder | Purpose |
| --- | --- |
| [`product-docs/`](./product-docs/) | Read-only product strategy, UX, use-case matrix |
| [`engineering/`](./engineering/) | Architecture, schema, implementation plan, **data access contract**, **module access guide** |
| [`progress/`](./progress/) | Delivery status, module rollout, in-progress / deferred items |
| [`testing/`](./testing/) | Manual UI tests and sample prompts |
| [`product-questions/`](./product-questions/) | Decisions to confirm with product |

---

## Quick links

- **Status:** [progress/PROGRESS.md](./progress/PROGRESS.md)
- **Product alignment:** [progress/PRODUCT_ALIGNMENT.md](./progress/PRODUCT_ALIGNMENT.md)
- **Manual QA:** [testing/MANUAL_UI_TESTS.md](./testing/MANUAL_UI_TESTS.md)
- **Read/write matrix:** [engineering/DATA_ACCESS_CONTRACT.md](./engineering/DATA_ACCESS_CONTRACT.md) · [`data-access.contract.ts`](../../src/features/co-pilot/contracts/data-access.contract.ts)
- **Module access (plain language):** [engineering/MODULE_ACCESS_GUIDE.md](./engineering/MODULE_ACCESS_GUIDE.md)
- **Product blockers:** [product-questions/OPEN_QUESTIONS.md](./product-questions/OPEN_QUESTIONS.md)
- **Architecture:** [engineering/ARCHITECTURE.md](./engineering/ARCHITECTURE.md)

---

## API

Base path: `/api/v1/co-pilot` (JWT + brand profile scope)

Frontend dashboard: `/brand/dashboard` in `creator-commerce-frontend-v2`
