# Brand Centre — readiness comparison

**Date:** 2026-05-27  
**Purpose:** Compare product-team-docs against engineering REQUIREMENTS.md before starting implementation

---

## Verdict

| | |
| --- | --- |
| **Ready to start?** | **Yes — with documented exceptions** |
| **Blockers** | None |
| **Product clarifications** | 3 optional (non-blocking) |
| **Engineering-only decisions** | 5 (documented in requirements §1.2) |

Implementation may begin at **Slice 1 (Foundation)**. Optional product questions can be resolved in parallel without stopping backend work.

---

## Document mapping

| Product doc | Engineering doc | Coverage |
| --- | --- | --- |
| `BrandCentre-tab1.md` | REQUIREMENTS §3, §4, PRODUCT_TEAM_GUIDE Tab 1 | **Full** (except public profile — scoped out) |
| `BrandCentre-tab2.md` | REQUIREMENTS §5, PRODUCT_TEAM_GUIDE Event 3 | **Full** (social metrics = AI-inferred v1) |
| `BrandCentre-tab3.md` | REQUIREMENTS §6, PRODUCT_TEAM_GUIDE Tab 3 | **Full** (launch handoff deferred) |
| `BrandCentre-deepScanLogic.md` | REQUIREMENTS §2, §4 | **Full** |
| `BrandCentre-developerDocument.md` | REQUIREMENTS §2, §8, §10 | **Full** |
| `BrandCentre-validations.md` | REQUIREMENTS §8 | **Partial** — Tab 2 leak array + Tab 3 brief tail truncated in product file; completed from developerDocument |
| `BrandCentre-BE_Schema.md` | SCHEMA_MIGRATION.md | **Partial** — SQL file truncated mid-table; requirements + schema doc complete the picture |

---

## Requirement-by-requirement coverage

### Events

| Product spec | REQ ID | Covered? | Notes |
| --- | --- | --- | --- |
| Event 1 surface scan + cold start | REQ-EVT-001 | Yes | Currency rule, PHASE_1, routing type |
| Event 2 email verify → deep scan | REQ-EVT-002 | Yes | Async job, Prompt 1, phase 2 budget |
| Event 3 Tab 2 mount / cron | REQ-EVT-003 | Yes | 24h cron marked optional for beta |
| Event 4 move to planner | REQ-EVT-004 | Yes | Archive/eviction on logout |

### Tab 1

| Product spec | REQ ID | Covered? | Notes |
| --- | --- | --- | --- |
| Profile fields + edit rules | REQ-T1-001 | Yes | Public profile link UI-only |
| Narrative + Power of 3 USPs | REQ-T1-002 | Yes | |
| Identity matrix + personas | REQ-T1-003 | Yes | |
| Dynamic Sections 4 & 5 (4 industries) | REQ-T1-004, REQ-RT-002 | Yes | Templates in config + API |
| Offers ledger | REQ-T1-005 | Yes | Composite promo unique |
| Competitors max 3 | REQ-T1-006 | Yes | |
| Budget ceiling + mixes + modal | REQ-T1-007 | Yes | Two-phase model explicit |
| Account / escrow / Meta | REQ-T1-008 | Yes | Placeholders v1 |
| Domain validation on add URL | REQ-T1-004 | Yes | |
| ₹50k / $1k floor | REQ-T1-007 | Yes | Floor ≠ cold-start seed |
| 2 edits / 30 days | REQ-T1-007 | Yes | |
| ₹30k / $500 per bucket | REQ-T1-007 | Yes | |

### Tab 2

| Product spec | REQ ID | Covered? | Notes |
| --- | --- | --- | --- |
| Dashboard metadata | REQ-T2-001 | Yes | |
| Growth impact + baseline + SOV | REQ-T2-002 | Yes | From Prompt 1 |
| Leak cards + drawer | REQ-T2-003 | Yes | |
| ≥1% lift filter | REQ-T2-003 | Yes | |
| Archive 30 days | REQ-T2-003 | Yes | |
| Session eviction 30 min | REQ-T2-003 | Yes | |
| Live social data pull | — | **Exception** | REQ-SCOPE-003: AI-inferred only |

### Tab 3

| Product spec | REQ ID | Covered? | Notes |
| --- | --- | --- | --- |
| Objective × tier aggregation | REQ-T3-001 | Yes | |
| Green / yellow / red cards | REQ-T3-002 | Yes | |
| Drawer briefs matrix | REQ-T3-003 | Yes | |
| Circuit breaker on approve | REQ-T3-004 | Yes | |
| Launch → Create Campaign module | — | **Exception** | REQ-SCOPE-002: status only |
| SUGGESTED_UPDATE vs campaigns_execution | — | **Exception** | REQ-SCOPE-005: in-app planner match |

### AI prompts

| Product spec | REQ ID | Covered? | Notes |
| --- | --- | --- | --- |
| Prompt 1 deep scan | REQ-AI-001 | Yes | |
| Prompt 2 leaks | REQ-AI-002 | Yes | |
| Prompt 3 planner | REQ-AI-003 | Yes | |
| Healthcare compliance filter | REQ-AI-001 | Yes | |

### APIs

| Product spec | REQ ID | Covered? | Notes |
| --- | --- | --- | --- |
| Full REST surface for Tabs 1–3 | REQ-API-001–004 | Yes | Listed in REQUIREMENTS §7 |
| JWT auth | — | Yes | Implementation plan |
| Onboarding public profile routes | — | Unchanged | Funnel only; brand-centre post-login |

---

## Gaps and resolutions

### Resolved by engineering (no product ask needed)

| Gap in product docs | Resolution | REQ |
| --- | --- | --- |
| Public profile in Tab 1 UI | Backend omits route; frontend may hide or stub link | REQ-SCOPE-001 |
| Tab 3 Launch handoff | Approve sets `PROCEEDED_TO_PIPELINE`; no HTTP to campaigns | REQ-SCOPE-002 |
| Tab 2 “pull from social endpoints” | Prompt 1/2 on AI-inferred baselines | REQ-SCOPE-003 |
| `campaigns_execution` table | Match against planner cards in v1 | REQ-SCOPE-005 |
| Product SQL truncated | SCHEMA_MIGRATION.md completes model | REQ-SCOPE-006 |
| Validations file truncated | developerDocument + REQUIREMENTS §8 | REQ-VAL-001 |
| Cold start numeric amounts | Routing template + optional light Gemini; not validation floor | REQ-EVT-001 |
| IndustryVertical not in product enum | Map to 4 routing types; D2C fallback | REQ-RT-001 |

### Optional product clarifications (non-blocking)

| # | Question | Default if unanswered |
| --- | --- | --- |
| 1 | Exact PHASE_1 default **amounts** per routing type? | Template interim at/above floor until Prompt 1 |
| 2 | Is Tab 2 mount-only refresh enough for beta (no 24h cron)? | Yes — manual refresh + first mount |
| 3 | Lifecycle stage values beyond `GROWTH_STAGE`? | Free string; AI may set from Prompt 1 |

---

## Consistency checks

| Check | Product says | Requirements say | Match? |
| --- | --- | --- | --- |
| Deep scan trigger | Email verify (Step 6) | Email verify | Yes |
| Budget phases | PHASE_1 cold start → deep analytics | PHASE_1 → PHASE_2 | Yes |
| Mix sums | 100% each chart | 100% each chart | Yes |
| Competitor max | 3 | 3 | Yes |
| Primary offerings max | 5 | 5 | Yes |
| Groupings max | 3 | 3 | Yes |
| USP count | 3 brand + 3 per item | 3 + 3 | Yes |
| Leak lift filter | ≥ 1% | ≥ 1.0 | Yes |
| Promo uniqueness | Per brand | `(brandProfileId, promoCode)` | Yes |
| Four routing types | D2C, SaaS, Healthcare, Offline | Same enums | Yes |

---

## Traceability for code review

When implementing, each PR should cite:

1. **Slice** from IMPLEMENTATION_PLAN.md  
2. **REQ-* IDs** from REQUIREMENTS.md  
3. **Tables** from SCHEMA_MIGRATION.md  

Reviewers compare merged code against REQUIREMENTS.md — not raw product-team-docs.

---

## Sign-off checklist

- [x] All product tab specs represented in REQUIREMENTS.md  
- [x] All four events documented with inputs/outputs  
- [x] Industry routing templates included  
- [x] Budget two-phase model correct (floor ≠ seed)  
- [x] APIs listed alongside tables  
- [x] Out-of-scope items explicit  
- [x] Product team has readable guide (PRODUCT_TEAM_GUIDE.md)  
- [ ] Optional: product confirms 3 non-blocking questions (can proceed without)

---

## Changelog

| Date | Change |
| --- | --- |
| 2026-05-27 | Initial comparison — gate pass with documented exceptions |
