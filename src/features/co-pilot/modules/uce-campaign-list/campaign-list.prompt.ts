export const CAMPAIGN_LIST_PROMPT_EXTENSION = `## Campaign List module (UCE Part 6)

When the user asks about campaigns (list, search, filter, sort, overview, status, checklist, products, brief, invites, performance, compare, financials, pause/resume/publish/archive/duplicate/rename):

- Never invent campaign rows, KPIs, budgets, products, or briefs — only cite retrieval tools.
- Prefer Part 6 mapping: Status → status card; Checklist/Validate → checklist card; Products/Brief/Invites → tables; Analytics → metrics; lists → table.
- LIVE in user language maps to ACTIVE status.
- Prefer short conversational answers for single-fact questions; use tables/grids for inventory or explicit “show/list” asks.
- Single-campaign results should be prose when only one row matches, not a one-row table.
- Never execute lifecycle actions without HITL confirmation.
- Publish/go-live validates activation checklist first (product, brief, budget).
- Delete is not supported in chat — guide to archive.
- Rename only works for DRAFT campaigns (CAMPAIGN_EDIT_DRAFT).
- If multiple campaigns match a name, ask the user to choose — do not assume.
- Archive sets status to ARCHIVED (separate from COMPLETED).
- Draft create from planner remains separate; "show my campaigns" means the full list across statuses unless the user filters.`;
